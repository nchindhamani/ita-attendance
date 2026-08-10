import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DateInput } from '@/components/ui/date-input'
import { HistoryTable } from '@/features/history/HistoryTable'
import { AttendanceStatistics } from '@/features/attendance/AttendanceStatistics'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { formatPacificDate } from '@/lib/time'
import { getCurrentSchoolYear } from '@/lib/school-year'
import { useWorkingDays } from '@/lib/use-working-days'
import { useRequireRole } from '@/lib/auth-client'

const supabase = createSupabaseBrowserClient()

type Section = {
  id: string
  grade: string
  section: string
}

type AttendanceEntry = {
  student_name: string
  student_identifier: number | null
  status: string
  comments: string | null
}

export default function AttendanceOfficerAttendancePage() {
  useRequireRole('attendance_officer')
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const sectionIdParam = searchParams.get('section')
  const dateParam = searchParams.get('date')

  const [sections, setSections] = useState<Section[]>([])
  const [selectedSectionId, setSelectedSectionId] = useState<string>(sectionIdParam || '')
  const [selectedDate, setSelectedDate] = useState<string>(dateParam || formatPacificDate(new Date()))
  const [schoolYear] = useState(getCurrentSchoolYear())
  const [attendanceEntries, setAttendanceEntries] = useState<AttendanceEntry[]>([])
  const [statistics, setStatistics] = useState({
    present: 0,
    absent: 0,
    late: 0,
    left_early: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const selectedSection = sections.find((s) => s.id === selectedSectionId)

  const { workingDays, pickerMin, pickerMax } = useWorkingDays({
    schoolYear,
    scope: selectedSection
      ? { mode: 'grade', grade: selectedSection.grade }
      : { mode: 'type', calendarType: 'regular' },
    selectedDate,
    dateParam,
    onDateResolved: (iso) => setSelectedDate(iso),
  })

  // Fetch sections on mount (read-only via RLS)
  useEffect(() => {
    const fetchSections = async () => {
      try {
        setLoading(true)
        setError(null)

        const { data, error: fetchError } = await supabase
          .from('sections')
          .select('id,grade,section')
          .eq('school_year', schoolYear)
          .order('grade', { ascending: true })

        if (fetchError) {
          throw new Error(fetchError.message)
        }

        setSections((data || []) as Section[])

        // Set default section if none selected
        if (!selectedSectionId && data && data.length > 0) {
          setSelectedSectionId(data[0].id)
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load sections'
        setError(errorMessage)
        console.error('Error fetching sections:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchSections()
  }, [schoolYear, selectedSectionId])

  // Fetch attendance when section or date changes
  useEffect(() => {
    if (!selectedSectionId) {
      setAttendanceEntries([])
      setStatistics({ present: 0, absent: 0, late: 0, left_early: 0 })
      return
    }

    const fetchAttendance = async () => {
      try {
        setLoading(true)
        setError(null)

        const { data, error: fetchError } = await supabase
          .from('student_attendance')
          .select(`
            status,
            comments,
            students!inner(full_name,student_identifier)
          `)
          .eq('attendance_date', selectedDate)
          .eq('section_id', selectedSectionId)

        if (fetchError) {
          throw new Error(fetchError.message)
        }

        const entries: AttendanceEntry[] = (data || []).map((item: any) => {
          const student = Array.isArray(item.students) ? item.students[0] : item.students
          return {
            student_name: student?.full_name ?? 'Unknown',
            student_identifier: student?.student_identifier ?? null,
            status: item.status,
            comments: item.comments,
          }
        })

        const stats = {
          present: entries.filter((e) => e.status === 'present').length,
          absent: entries.filter((e) => e.status === 'absent').length,
          late: entries.filter((e) => e.status === 'late').length,
          left_early: entries.filter((e) => e.status === 'left_early').length,
        }

        setAttendanceEntries(entries)
        setStatistics(stats)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load attendance'
        setError(errorMessage)
        console.error('Error fetching attendance:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchAttendance()
  }, [selectedSectionId, selectedDate])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const newParams = new URLSearchParams()
    if (selectedSectionId) newParams.set('section', selectedSectionId)
    if (selectedDate) newParams.set('date', selectedDate)
    navigate(`/attendance-officer/attendance?${newParams.toString()}`, { replace: true })
  }

  const filename = `attendance-${selectedSection?.grade ?? ''}-${selectedSection?.section ?? ''}-${selectedDate}.csv`

  if (loading && sections.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (error && sections.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <p className="text-destructive">{error}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Manage Attendance</h2>
        <p className="text-sm text-muted-foreground">
          View and edit attendance for all sections.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-3">
            <select
              name="section"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
            >
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  Grade {section.grade} - {section.section}
                </option>
              ))}
            </select>
            <DateInput
              value={selectedDate}
              onChange={(newDate) => {
                if (workingDays.length && !workingDays.includes(newDate)) {
                  toast.error('That date is not a working day. Choose a listed class day.')
                  return
                }
                setSelectedDate(newDate)
              }}
              min={pickerMin}
              max={pickerMax}
              allowedDates={workingDays.length > 0 ? workingDays : undefined}
              onDisallowedDate={() => {
                toast.error('That date is not a working day. Choose a listed class day.')
              }}
              className="h-10 min-w-[180px]"
            />
            <Button type="submit">View</Button>
          </form>
        </CardContent>
      </Card>

      {attendanceEntries.length > 0 && (
        <AttendanceStatistics counts={statistics} />
      )}

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <p className="text-muted-foreground">Loading attendance...</p>
        </div>
      ) : error ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      ) : (
        <HistoryTable rows={attendanceEntries} filename={filename} />
      )}
    </div>
  )
}
