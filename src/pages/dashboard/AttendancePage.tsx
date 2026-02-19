import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useRequireActiveProfile } from '@/lib/auth-client'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { formatPacificDate, isAfterDailyCutoff } from '@/lib/time'
import type { AttendanceStatus } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AttendanceEditor } from '@/features/attendance/AttendanceEditor'

const supabase = createSupabaseBrowserClient()

type Section = {
  id: string
  grade: string | null
  section: string | null
  room_number: string | null
  school_year: string | null
}

type Student = {
  id: string
  full_name: string
  student_identifier: number | null
}

type Holiday = {
  holiday_date: string
  name: string
}

type AttendanceEntry = {
  student_id: string
  status: AttendanceStatus
  comments: string | null
}

export default function AttendancePage() {
  console.log('AttendancePage component loaded')
  const { profile, loading: authLoading } = useRequireActiveProfile()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  
  const sectionId = searchParams.get('section')
  console.log('Section ID:', sectionId, 'Profile:', profile)
  const [loading, setLoading] = useState(true)
  const [section, setSection] = useState<Section | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [existingAttendance, setExistingAttendance] = useState<Record<string, { status: AttendanceStatus; comments?: string | null }>>({})
  const [holiday, setHoliday] = useState<Holiday | null>(null)
  const [error, setError] = useState<string | null>(null)

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
          navigate(`/attendance?section=${assignedSectionId}`, { replace: true })
          return
        }
      }
    }

    fetchTeacherSection()
  }, [profile, sectionId, navigate, authLoading])

  // Function to fetch students (extracted for reuse)
  const fetchStudents = async (sectionIdToFetch: string) => {
    const { data: studentsData, error: studentsError } = await supabase
      .from('students')
      .select('id,full_name,student_identifier')
      .eq('section_id', sectionIdToFetch)
      .order('full_name', { ascending: true })

    if (studentsError) {
      console.error('Failed to load students:', studentsError)
      return null
    }

    return studentsData ?? []
  }

  // Fetch section data, students, and attendance
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
          .select('id,grade,section,room_number,school_year')
          .eq('id', sectionId)
          .maybeSingle()

        if (sectionError || !sectionData) {
          setError('Section not found')
          setLoading(false)
          return
        }

        setSection(sectionData)

        const attendanceDate = formatPacificDate(new Date())

        // Check for holiday
        const { data: holidayData } = await supabase
          .from('holidays')
          .select('holiday_date,name')
          .eq('school_year', sectionData.school_year ?? '')
          .eq('holiday_date', attendanceDate)
          .maybeSingle()

        if (holidayData) {
          setHoliday(holidayData)
        }

        // Fetch students
        const studentsData = await fetchStudents(sectionId)
        if (studentsData === null) {
          setError('Failed to load students')
          setLoading(false)
          return
        }

        setStudents(studentsData)

        // Fetch existing attendance
        const studentIds = (studentsData ?? []).map(s => s.id)
        if (studentIds.length > 0) {
          const { data: attendanceData } = await supabase
            .from('attendance')
            .select('student_id,status,comments')
            .eq('attendance_date', attendanceDate)
            .in('student_id', studentIds)

          const existing = (attendanceData ?? []).reduce(
            (acc, entry) => {
              acc[entry.student_id] = {
                status: entry.status as AttendanceStatus,
                comments: entry.comments ?? '',
              }
              return acc
            },
            {} as Record<string, { status: AttendanceStatus; comments?: string | null }>
          )

          setExistingAttendance(existing)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [sectionId, profile, authLoading])

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
          Choose a section from your dashboard to take attendance.
        </CardContent>
      </Card>
    )
  }

  if (!section) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Section not found</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">The requested section could not be found.</p>
        </CardContent>
      </Card>
    )
  }

  const attendanceDate = formatPacificDate(new Date())
  // COMMENTED OUT FOR TESTING - Daily cutoff check
  // const locked = isAfterDailyCutoff(new Date()) || Boolean(holiday)
  const locked = Boolean(holiday) // Only lock on holidays, not time-based

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">
          Attendance - Grade {section.grade} {section.section}
        </h2>
        <p className="text-sm text-muted-foreground">
          School year: {section.school_year}
        </p>
      </div>
      <AttendanceEditor
        sectionId={sectionId}
        schoolYear={section.school_year ?? ''}
        attendanceDate={attendanceDate}
        students={students}
        existing={existingAttendance}
        locked={locked}
        holidayName={holiday?.name ?? null}
        onStudentAdded={async () => {
          // Refresh student list after adding a new student
          if (sectionId) {
            const updatedStudents = await fetchStudents(sectionId)
            if (updatedStudents !== null) {
              setStudents(updatedStudents)
              // Also refresh existing attendance to include the new student
              const attendanceDate = formatPacificDate(new Date())
              const studentIds = updatedStudents.map(s => s.id)
              if (studentIds.length > 0) {
                const { data: attendanceData } = await supabase
                  .from('attendance')
                  .select('student_id,status,comments')
                  .eq('attendance_date', attendanceDate)
                  .in('student_id', studentIds)

                const existing = (attendanceData ?? []).reduce(
                  (acc, entry) => {
                    acc[entry.student_id] = {
                      status: entry.status as AttendanceStatus,
                      comments: entry.comments ?? '',
                    }
                    return acc
                  },
                  {} as Record<string, { status: AttendanceStatus; comments?: string | null }>
                )
                setExistingAttendance(existing)
              }
            }
          }
        }}
      />
    </div>
  )
}
