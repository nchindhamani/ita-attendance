import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useRequireActiveProfile } from '@/lib/auth-client'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { formatPacificDate } from '@/lib/time'
import { getCurrentSchoolYear } from '@/lib/school-year'
import { useWorkingDays } from '@/lib/use-working-days'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DateInput } from '@/components/ui/date-input'
import { Button } from '@/components/ui/button'
import { HistoryTable } from '@/features/history/HistoryTable'
import { AttendanceStatistics } from '@/features/attendance/AttendanceStatistics'

const supabase = createSupabaseBrowserClient()

type HistoryRow = {
  student_name: string
  student_identifier: number | null
  status: string
  comments: string | null
}

export default function HistoryPage() {
  const { profile, loading: authLoading } = useRequireActiveProfile()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  
  const sectionId = searchParams.get('section')
  const selectedDate = searchParams.get('date') || formatPacificDate(new Date())
  const schoolYear = getCurrentSchoolYear()
  
  const [loading, setLoading] = useState(true)
  const [section, setSection] = useState<{ grade: string | null; section: string | null } | null>(null)
  const [rows, setRows] = useState<HistoryRow[]>([])
  const [statistics, setStatistics] = useState({
    present: 0,
    absent: 0,
    late: 0,
    left_early: 0,
  })
  const [error, setError] = useState<string | null>(null)
  const [pickerDate, setPickerDate] = useState(selectedDate)

  const { workingDays, pickerMin, pickerMax } = useWorkingDays({
    schoolYear,
    scope: { mode: 'grade', grade: section?.grade },
    selectedDate: pickerDate,
    dateParam: searchParams.get('date'),
    onDateResolved: (iso) => setPickerDate(iso),
  })

  // Auto-redirect teachers to their assigned section
  useEffect(() => {
    if (authLoading || !profile) return

    const fetchTeacherSection = async () => {
      if (!sectionId && profile.role === 'teacher') {
        const { data: assignments } = await supabase
          .from('teacher_sections')
          .select('section_id')
          .eq('teacher_id', profile.id)
          .limit(1)

        const assignedSectionId = assignments?.[0]?.section_id
        if (assignedSectionId) {
          navigate(`/history?section=${assignedSectionId}&date=${selectedDate}`, { replace: true })
          return
        }
      }
    }

    fetchTeacherSection()
  }, [profile, sectionId, navigate, authLoading, selectedDate])

  // Fetch attendance history
  useEffect(() => {
    if (authLoading || !profile || !sectionId) {
      if (!sectionId && profile && profile.role !== 'teacher') {
        setLoading(false)
      }
      return
    }

    const fetchData = async () => {
      setLoading(true)
      setError(null)

      try {
        // Fetch section data
        const { data: sectionData, error: sectionError } = await supabase
          .from('sections')
          .select('grade,section')
          .eq('id', sectionId)
          .maybeSingle()

        if (sectionError || !sectionData) {
          setError('Section not found')
          setLoading(false)
          return
        }

        setSection(sectionData)

        // Fetch attendance for the selected date
        const { data: attendance, error: attendanceError } = await supabase
          .from('student_attendance')
          .select('status,comments,students!inner(full_name,student_identifier)')
          .eq('attendance_date', selectedDate)
          .eq('section_id', sectionId)

        if (attendanceError) {
          setError('Failed to load attendance')
          setLoading(false)
          return
        }

        // Transform attendance data to rows
        const transformedRows: HistoryRow[] = (attendance ?? []).map((entry) => {
          const student = Array.isArray(entry.students)
            ? entry.students[0]
            : entry.students
          return {
            student_name: student?.full_name ?? 'Unknown',
            student_identifier: student?.student_identifier ?? null,
            status: entry.status,
            comments: entry.comments ?? null,
          }
        })

        setRows(transformedRows)

        // Calculate statistics
        const stats = {
          present: (attendance ?? []).filter((entry) => entry.status === 'present').length,
          absent: (attendance ?? []).filter((entry) => entry.status === 'absent').length,
          late: (attendance ?? []).filter((entry) => entry.status === 'late').length,
          left_early: (attendance ?? []).filter((entry) => entry.status === 'left_early').length,
        }
        setStatistics(stats)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [sectionId, selectedDate, profile, authLoading])

  useEffect(() => {
    setPickerDate(selectedDate)
  }, [selectedDate])

  const handleDateChange = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (pickerDate && sectionId) {
      navigate(`/history?section=${sectionId}&date=${pickerDate}`)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (!sectionId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Select a section</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Choose a section from your dashboard to view attendance history.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-[2.5rem] font-heading font-bold text-[#0f172a] leading-tight mb-3">
          History - Grade {section?.grade} {section?.section}
        </h2>
        <p className="text-lg text-[#64748b] font-normal leading-relaxed">
          Review or download attendance from a prior date.
        </p>
      </div>

      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-lg">Pick a date</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <form onSubmit={handleDateChange} className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1 sm:max-w-[180px]">
              <DateInput
                value={pickerDate}
                min={pickerMin}
                max={pickerMax}
                allowedDates={workingDays.length > 0 ? workingDays : undefined}
                onDisallowedDate={() => {
                  toast.error('That date is not a working day. Choose a listed class day.')
                }}
                onChange={(newDate) => {
                  if (workingDays.length && !workingDays.includes(newDate)) {
                    toast.error('That date is not a working day. Choose a listed class day.')
                    return
                  }
                  setPickerDate(newDate)
                }}
                className="w-full"
              />
            </div>
            <Button type="submit" className="w-full sm:w-auto">
              View
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      {rows.length > 0 && <AttendanceStatistics counts={statistics} />}

      <HistoryTable
        rows={rows}
        filename={`attendance-${section?.grade ?? ''}-${section?.section ?? ''}-${selectedDate}.csv`}
      />
    </div>
  )
}
