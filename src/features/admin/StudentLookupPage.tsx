import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StudentAttendanceSearch } from '@/features/admin/StudentAttendanceSearch'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

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
  section_id?: string | null
}

interface HSCPSection {
  id: string
  section: string
}

export interface StudentLookupPageProps {
  basePath?: string
  title?: string
  canDelete?: boolean
}

export function StudentLookupPage({
  basePath = '/admin/student-attendance',
  title = 'Student Attendance Lookup',
  canDelete = false,
}: StudentLookupPageProps) {
  const [searchParams] = useSearchParams()

  const studentIdInput = searchParams.get('studentId')?.trim() || ''
  const yearInput = searchParams.get('year')?.trim() || ''

  const [loading, setLoading] = useState(false)
  const [availableYears, setAvailableYears] = useState<string[]>([])
  const [student, setStudent] = useState<Student | null>(null)
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [sectionInfo, setSectionInfo] = useState<{ grade: string; section: string } | null>(null)
  const [teacherName, setTeacherName] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [hscpSections, setHscpSections] = useState<HSCPSection[]>([])
  const [selectedHscpTab, setSelectedHscpTab] = useState<string>('Reading')
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

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
        const yearSet = new Set<string>()

        // Years from student_attendance (student has at least one attendance record)
        const { data: attendanceYearRows, error: attendanceYearError } = await supabase
          .from('student_attendance')
          .select('school_year')
          .eq('student_identifier', studentIdNum)
          .order('school_year', { ascending: false })

        if (!attendanceYearError && attendanceYearRows) {
          attendanceYearRows.forEach((row) => {
            if (row.school_year && !yearSet.has(row.school_year)) {
              yearSet.add(row.school_year)
            }
          })
        }

        // Years from students table (student exists for that year, even with no attendance)
        const { data: studentYearRows, error: studentYearError } = await supabase
          .from('students')
          .select('school_year')
          .eq('student_identifier', studentIdNum)
          .order('school_year', { ascending: false })

        if (!studentYearError && studentYearRows) {
          studentYearRows.forEach((row) => {
            if (row.school_year && !yearSet.has(row.school_year)) {
              yearSet.add(row.school_year)
            }
          })
        }

        const orderedYears = Array.from(yearSet).sort((a, b) => b.localeCompare(a))
        setAvailableYears(orderedYears)
        setErrorMessage(null)
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'An error occurred')
        setAvailableYears([])
      }
    }

    fetchYears()
  }, [studentIdInput])

  useEffect(() => {
    if (!studentIdInput || !yearInput) {
      setStudent(null)
      setAttendance([])
      setSectionInfo(null)
      setTeacherName(null)
      setHscpSections([])
      setSelectedHscpTab('Reading')
      return
    }

    const fetchStudentData = async () => {
      setLoading(true)
      setErrorMessage(null)
      setStudent(null)
      setAttendance([])
      setSectionInfo(null)
      setTeacherName(null)
      setHscpSections([])
      setSelectedHscpTab('Reading')

      const studentIdNum = Number(studentIdInput)
      if (!Number.isInteger(studentIdNum)) {
        setErrorMessage('Student ID must be a number.')
        setLoading(false)
        return
      }

      if (!availableYears.includes(yearInput)) {
        setErrorMessage('Invalid school year selected.')
        setLoading(false)
        return
      }

      try {
        const { data: foundStudent, error: studentError } = await supabase
          .from('students')
          .select('id,full_name,student_identifier,section_id,school_year')
          .eq('student_identifier', studentIdNum)
          .eq('school_year', yearInput)
          .maybeSingle()

        if (studentError) {
          setErrorMessage(`Error: ${studentError.message}`)
          setLoading(false)
          return
        }

        if (!foundStudent) {
          setErrorMessage('No student found for the selected school year.')
          setLoading(false)
          return
        }

        const studentData = Array.isArray(foundStudent) ? foundStudent[0] : foundStudent

        if (!studentData || !('id' in studentData) || !('full_name' in studentData)) {
          setErrorMessage('No student found for the selected school year.')
          setLoading(false)
          return
        }

        setStudent(studentData as Student)

        if (studentData.section_id) {
          const { data: section, error: sectionError } = await supabase
            .from('sections')
            .select('grade,section,school_year')
            .eq('id', studentData.section_id)
            .eq('school_year', yearInput)
            .maybeSingle()

          if (!sectionError && section) {
            const sectionData = Array.isArray(section) ? section[0] : section
            if (sectionData && 'grade' in sectionData && 'section' in sectionData) {
              setSectionInfo({
                grade: sectionData.grade,
                section: sectionData.section,
              })

              const isHSCPGrade = sectionData.grade && sectionData.grade.toUpperCase().startsWith('HSCP')

              if (isHSCPGrade) {
                const { data: allSections, error: sectionsError } = await supabase
                  .from('sections')
                  .select('id,section')
                  .eq('grade', sectionData.grade)
                  .eq('school_year', yearInput)
                  .in('section', ['Reading', 'Writing', 'Conversation'])
                  .order('section', { ascending: true })

                if (!sectionsError && allSections) {
                  setHscpSections(allSections as HSCPSection[])
                  if (allSections.length > 0) {
                    setSelectedHscpTab(allSections[0].section)
                  }
                }
              } else {
                setHscpSections([])
              }

              const { data: teacherSection } = await supabase
                .from('teacher_sections')
                .select('teacher_id')
                .eq('section_id', studentData.section_id)
                .limit(1)
                .maybeSingle()

              if (teacherSection && teacherSection.teacher_id) {
                const { data: teacher } = await supabase
                  .from('profiles')
                  .select('full_name')
                  .eq('id', teacherSection.teacher_id)
                  .maybeSingle()

                if (teacher) {
                  const teacherData = Array.isArray(teacher) ? teacher[0] : teacher
                  if (teacherData && 'full_name' in teacherData) {
                    setTeacherName(teacherData.full_name)
                  }
                }
              }
            }
          }
        }

        const { data: attendanceData, error: attendanceError } = await supabase
          .from('student_attendance')
          .select('attendance_date,status,comments,section_id')
          .eq('student_id', studentData.id)
          .eq('school_year', yearInput)
          .order('attendance_date', { ascending: false })

        if (attendanceError) {
          console.error('Error fetching attendance:', attendanceError)
        } else {
          setAttendance(attendanceData ?? [])
        }
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchStudentData()
  }, [studentIdInput, yearInput, availableYears])

  const statusColors = {
    present: 'bg-[#d1fae5] text-[#065f46]',
    absent: 'bg-[#fee2e2] text-[#991b1b]',
    late: 'bg-[#fed7aa] text-[#9a3412]',
    left_early: 'bg-[#e9d5ff] text-[#6b21a8]',
  }

  const handleDeleteStudent = async () => {
    if (!student || deleting) return
    try {
      setDeleting(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error('Not authenticated. Please sign in again.')
        setDeleting(false)
        return
      }
      const response = await fetch(`/api/admin/students/${student.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        toast.error(data.error || data.detail || 'Failed to delete student.')
        setDeleting(false)
        return
      }
      setDeleteConfirmOpen(false)
      setStudent(null)
      setAttendance([])
      setSectionInfo(null)
      setTeacherName(null)
      setHscpSections([])
      setAvailableYears(prev => prev.filter(y => y !== yearInput))
      toast.success(data.message || 'Student deleted.')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'An unexpected error occurred.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[2.5rem] font-heading font-bold text-[#0f172a] leading-tight mb-3">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">
          Search by ITA Student ID and pick a school year.
        </p>
      </div>

      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-lg">Search</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <StudentAttendanceSearch
            initialStudentId={studentIdInput}
            initialYear={yearInput}
            availableYears={availableYears}
            hasError={!!errorMessage}
            basePath={basePath}
          />
          {errorMessage ? (
            <p className="mt-3 text-sm text-destructive">{errorMessage}</p>
          ) : null}
          {studentIdInput && availableYears.length === 0 && !errorMessage ? (
            <p className="mt-3 text-sm text-destructive">
              No student found for this ID. Please verify the student ID.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {student && (
        <div className="space-y-6">
          <div className="bg-white rounded-[16px] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-[1.75rem] font-heading font-bold text-[#0f172a] leading-tight mb-4">
                  {student.full_name}
                </h3>
                <div className="space-y-2">
                  <p className="text-sm text-[#64748b]">ID: {student.student_identifier ?? '-'}</p>
                  {sectionInfo && (
                    <p className="text-sm text-[#64748b]">
                      {sectionInfo.grade.toUpperCase().startsWith('HSCP')
                        ? `Grade: ${sectionInfo.grade}`
                        : `Class: Grade ${sectionInfo.grade} - ${sectionInfo.section}`}
                    </p>
                  )}
                  {teacherName && (
                    <p className="text-sm text-[#64748b]">Teacher: {teacherName}</p>
                  )}
                </div>
              </div>
              {canDelete && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-2 shrink-0"
                  onClick={() => setDeleteConfirmOpen(true)}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Student
                </Button>
              )}
            </div>
          </div>

          {attendance.length > 0 || student ? (
            <div className="space-y-4">
              <h4 className="text-xl font-heading font-semibold text-[#0f172a]">
                Attendance History
              </h4>

              {hscpSections.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex gap-2 border-b border-gray-200">
                    {hscpSections.map((hscpSection) => (
                      <button
                        key={hscpSection.id}
                        onClick={() => setSelectedHscpTab(hscpSection.section)}
                        className={`px-4 py-2 font-medium text-sm transition-colors ${
                          selectedHscpTab === hscpSection.section
                            ? 'border-b-2 border-[#6366f1] text-[#6366f1]'
                            : 'text-[#64748b] hover:text-[#0f172a]'
                        }`}
                      >
                        {hscpSection.section}
                      </button>
                    ))}
                  </div>

                  {(() => {
                    const selectedSection = hscpSections.find(s => s.section === selectedHscpTab)
                    const filteredAttendance = selectedSection
                      ? attendance.filter(a => a.section_id === selectedSection.id)
                      : []

                    return filteredAttendance.length > 0 ? (
                      <div className="space-y-3">
                        {filteredAttendance.map((row) => {
                          const statusColor =
                            statusColors[row.status as keyof typeof statusColors] ||
                            'bg-gray-100 text-gray-700'

                          return (
                            <div
                              key={`${row.attendance_date}-${row.section_id}`}
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
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No attendance recorded for {selectedHscpTab} section yet.
                      </p>
                    )
                  })()}
                </div>
              ) : (
                attendance.length > 0 ? (
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
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No attendance recorded for this student yet.
                  </p>
                )
              )}
            </div>
          ) : null}
        </div>
      )}

      {canDelete && (
        <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>Delete Student</DialogTitle>
              <DialogDescription>
                This will permanently remove this student and all their attendance data. This action cannot be undone. Do you still wish to proceed?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} disabled={deleting}>
                No
              </Button>
              <Button variant="destructive" onClick={handleDeleteStudent} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Yes, delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
