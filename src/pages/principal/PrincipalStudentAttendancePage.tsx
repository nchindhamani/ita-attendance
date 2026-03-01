import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRequireRole } from '@/lib/auth-client'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StudentAttendanceSearch } from '@/features/admin/StudentAttendanceSearch'

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

export default function PrincipalStudentAttendancePage() {
  useRequireRole('principal')
  const navigate = useNavigate()
  
  const [searchParams] = useState(new URLSearchParams(window.location.search))
  const studentIdInput = searchParams.get('studentId')?.trim() || ''
  const yearInput = searchParams.get('year')?.trim() || ''
  
  const [loading, setLoading] = useState(false)
  const [availableYears, setAvailableYears] = useState<string[]>([])
  const [student, setStudent] = useState<Student | null>(null)
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [sectionInfo, setSectionInfo] = useState<{ grade: string; section: string } | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Fetch available years when studentId is provided
  useEffect(() => {
    if (!studentIdInput) {
      setAvailableYears([])
      return
    }

    const fetchYears = async () => {
      const studentIdNum = Number(studentIdInput)
      if (!Number.isInteger(studentIdNum)) {
        setErrorMessage('Student ID must be a valid number.')
        setAvailableYears([])
        return
      }

      try {
        const { data: yearRows, error: yearError } = await supabase
          .from('student_attendance')
          .select('school_year')
          .eq('student_identifier', studentIdNum)
          .order('school_year', { ascending: false })

        if (yearError) {
          setErrorMessage(`Error fetching years: ${yearError.message}`)
          setAvailableYears([])
          return
        }

        const yearSet = new Set<string>()
        const orderedYears: string[] = []
        ;(yearRows ?? []).forEach((row) => {
          if (row.school_year && !yearSet.has(row.school_year)) {
            yearSet.add(row.school_year)
            orderedYears.push(row.school_year)
          }
        })
        setAvailableYears(orderedYears)
        setErrorMessage(null)
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'An error occurred')
        setAvailableYears([])
      }
    }

    fetchYears()
  }, [studentIdInput])

  // Fetch student and attendance when both studentId and year are provided
  useEffect(() => {
    if (!studentIdInput || !yearInput) {
      setStudent(null)
      setAttendance([])
      setSectionInfo(null)
      return
    }

    const fetchStudentData = async () => {
      setLoading(true)
      setErrorMessage(null)

      try {
        const studentIdNum = Number(studentIdInput)
        if (!Number.isInteger(studentIdNum)) {
          setErrorMessage('Student ID must be a valid number.')
          setLoading(false)
          return
        }

        // Fetch student
        const { data: students, error: studentError } = await supabase
          .from('students')
          .select('id,full_name,student_identifier,section_id,school_year')
          .eq('student_identifier', studentIdNum)
          .eq('school_year', yearInput)
          .maybeSingle()

        if (studentError) {
          setErrorMessage(`Error fetching student: ${studentError.message}`)
          setLoading(false)
          return
        }

        if (!students) {
          setErrorMessage('Student not found.')
          setLoading(false)
          return
        }

        setStudent(students as Student)

        // Fetch section info if section_id exists
        if (students.section_id) {
          const { data: section, error: sectionError } = await supabase
            .from('sections')
            .select('grade,section')
            .eq('id', students.section_id)
            .maybeSingle()

          if (!sectionError && section) {
            setSectionInfo({ grade: section.grade, section: section.section })
          }
        }

        // Fetch attendance
        const { data: attendanceData, error: attendanceError } = await supabase
          .from('student_attendance')
          .select('attendance_date,status,comments')
          .eq('student_identifier', studentIdNum)
          .eq('school_year', yearInput)
          .order('attendance_date', { ascending: false })

        if (attendanceError) {
          setErrorMessage(`Error fetching attendance: ${attendanceError.message}`)
          setLoading(false)
          return
        }

        setAttendance((attendanceData || []) as AttendanceRecord[])
        setErrorMessage(null)
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchStudentData()
  }, [studentIdInput, yearInput])

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-[2.5rem] font-heading font-bold text-[#0f172a] leading-tight mb-3">
          Student Attendance Lookup
        </h2>
        <p className="text-base text-muted-foreground">
          Search for student attendance records (read-only).
        </p>
      </div>

      <StudentAttendanceSearch
        initialStudentId={studentIdInput}
        initialYear={yearInput}
        availableYears={availableYears}
        basePath="/principal/student-attendance"
      />

      {errorMessage && (
        <Card>
          <CardContent className="p-6">
            <p className="text-destructive">{errorMessage}</p>
          </CardContent>
        </Card>
      )}

      {loading && (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      )}

      {!loading && student && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Student Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p><strong>Name:</strong> {student.full_name}</p>
              <p><strong>Student ID:</strong> {student.student_identifier}</p>
              {sectionInfo && (
                <p><strong>Section:</strong> {sectionInfo.grade}/{sectionInfo.section}</p>
              )}
              <p><strong>School Year:</strong> {yearInput}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Attendance Records ({attendance.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {attendance.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Date</th>
                        <th className="text-left p-2">Status</th>
                        <th className="text-left p-2">Comments</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendance.map((record, idx) => (
                        <tr key={idx} className="border-b">
                          <td className="p-2">
                            {new Date(record.attendance_date).toLocaleDateString()}
                          </td>
                          <td className="p-2 capitalize">{record.status}</td>
                          <td className="p-2">{record.comments || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted-foreground">No attendance records found.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}



