import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useRequireActiveProfile } from '@/lib/auth-client'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const supabase = createSupabaseBrowserClient()

interface Student {
  id: string
  full_name: string
  student_identifier: number | null
  section_id: string | null
  school_year: string
}

interface AttendanceRecord {
  attendance_date: string
  status: string
  comments: string | null
}

export default function TeacherStudentAttendancePage() {
  const { profile, loading: authLoading } = useRequireActiveProfile()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  
  const studentIdInput = searchParams.get('studentId')?.trim() || ''
  
  const [loading, setLoading] = useState(false)
  const [schoolYear, setSchoolYear] = useState<string>('')
  const [student, setStudent] = useState<Student | null>(null)
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [sectionInfo, setSectionInfo] = useState<{ grade: string; section: string } | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Fetch current school year and allowed sections
  useEffect(() => {
    if (authLoading || !profile) return

    const fetchData = async () => {
      try {
        // Get current school year
        const { data: settings } = await supabase
          .from('system_settings')
          .select('current_school_year')
          .eq('id', 1)
          .single()

        const currentYear = settings?.current_school_year ?? '2025-2026'
        setSchoolYear(currentYear)

        // If studentId is provided, search for student
        if (studentIdInput) {
          await searchStudent(studentIdInput, currentYear)
        }
      } catch (err) {
        console.error('Error fetching data:', err)
      }
    }

    fetchData()
  }, [authLoading, profile])

  const searchStudent = async (studentId: string, year: string) => {
    setLoading(true)
    setErrorMessage(null)
    setStudent(null)
    setAttendance([])
    setSectionInfo(null)

    try {
      // Get teacher's assigned sections for current school year
      const { data: assignments } = await supabase
        .from('teacher_sections')
        .select('section:sections(id,school_year)')
        .eq('teacher_id', profile!.id)
        .eq('sections.school_year', year)

      const allowedSectionIds = new Set(
        (assignments ?? [])
          .map((item) => {
            const section = Array.isArray(item.section) ? item.section[0] : item.section
            return section?.id
          })
          .filter(Boolean) as string[]
      )

      if (allowedSectionIds.size === 0) {
        setErrorMessage('No class is assigned to your account yet.')
        setLoading(false)
        return
      }

      // Search for student
      const { data: foundStudent, error: studentError } = await supabase
        .from('students')
        .select('id,full_name,student_identifier,section_id,school_year')
        .eq('student_identifier', studentId)
        .eq('school_year', year)
        .maybeSingle()

      if (studentError) {
        setErrorMessage(`Error: ${studentError.message}`)
        setLoading(false)
        return
      }

      if (!foundStudent) {
        setErrorMessage('No student found for the current school year.')
        setLoading(false)
        return
      }

      const studentData = Array.isArray(foundStudent) ? foundStudent[0] : foundStudent

      if (!studentData || !('id' in studentData) || !('full_name' in studentData)) {
        setErrorMessage('No student found for the current school year.')
        setLoading(false)
        return
      }

      if (!studentData.section_id || !allowedSectionIds.has(studentData.section_id)) {
        setErrorMessage("You are not assigned to this student's class.")
        setLoading(false)
        return
      }

      setStudent(studentData as Student)

      // Fetch attendance records
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('attendance_date,status,comments')
        .eq('student_id', studentData.id)
        .eq('school_year', year)
        .order('attendance_date', { ascending: false })

      if (attendanceError) {
        console.error('Error fetching attendance:', attendanceError)
      } else {
        setAttendance(attendanceData ?? [])
      }

      // Fetch section information
      if (studentData.section_id) {
        const { data: section, error: sectionError } = await supabase
          .from('sections')
          .select('grade,section')
          .eq('id', studentData.section_id)
          .maybeSingle()

        if (!sectionError && section) {
          const sectionData = Array.isArray(section) ? section[0] : section
          if (sectionData && 'grade' in sectionData && 'section' in sectionData) {
            setSectionInfo({
              grade: sectionData.grade,
              section: sectionData.section,
            })
          }
        }
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const studentId = (formData.get('studentId') as string)?.trim()
    
    if (studentId && schoolYear) {
      navigate(`/teacher/student-attendance?studentId=${studentId}`)
      searchStudent(studentId, schoolYear)
    }
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  const statusColors = {
    present: 'bg-[#d1fae5] text-[#065f46]',
    absent: 'bg-[#fee2e2] text-[#991b1b]',
    late: 'bg-[#fed7aa] text-[#9a3412]',
    left_early: 'bg-[#e9d5ff] text-[#6b21a8]',
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Student Attendance Lookup</h2>
        <p className="text-sm text-muted-foreground">
          Search by ITA Student ID for the current school year ({schoolYear}).
        </p>
      </div>

      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-lg">Search by Student ID</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <form onSubmit={handleSearch} className="flex items-center gap-3">
            <div className="w-auto max-w-[180px]">
              <Input
                name="studentId"
                placeholder="Enter ITA student ID"
                defaultValue={studentIdInput}
                className="w-full"
                disabled={loading}
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? 'Searching...' : 'Search'}
            </Button>
          </form>
          {errorMessage ? (
            <p className="mt-3 text-sm text-destructive">{errorMessage}</p>
          ) : null}
        </CardContent>
      </Card>

      {student && (
        <div className="space-y-6">
          <div className="bg-white rounded-[16px] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
            <h3 className="text-[1.75rem] font-heading font-bold text-[#0f172a] leading-tight mb-4">
              {student.full_name}
            </h3>
            <div className="space-y-2">
              <p className="text-sm text-[#64748b]">ID: {student.student_identifier ?? '-'}</p>
              {sectionInfo && (
                <p className="text-sm text-[#64748b]">
                  Class: Grade {sectionInfo.grade} - {sectionInfo.section}
                </p>
              )}
              {profile?.full_name && (
                <p className="text-sm text-[#64748b]">Teacher: {profile.full_name}</p>
              )}
            </div>
          </div>

          {attendance.length > 0 ? (
            <div className="space-y-4">
              <h4 className="text-xl font-heading font-semibold text-[#0f172a]">
                Attendance History
              </h4>
              <div className="space-y-3">
                {attendance.map((row) => {
                  const statusColor =
                    statusColors[row.status as keyof typeof statusColors] ||
                    'bg-gray-100 text-gray-700'

                  return (
                    <div
                      key={row.attendance_date}
                      className="bg-[#f8f9fa] rounded-[12px] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.1)]"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-base font-medium text-[#0f172a] w-32 flex-shrink-0">
                          {row.attendance_date}
                        </span>
                        <span
                          className={`px-3 py-1 rounded-[8px] text-sm font-medium capitalize whitespace-nowrap ${statusColor}`}
                        >
                          {row.status}
                        </span>
                        {row.comments && (
                          <span className="text-sm text-[#64748b]">{row.comments}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : student ? (
            <p className="text-sm text-muted-foreground">
              No attendance recorded for this student yet.
            </p>
          ) : null}
        </div>
      )}
    </div>
  )
}
