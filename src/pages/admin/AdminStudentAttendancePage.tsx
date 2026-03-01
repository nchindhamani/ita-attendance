import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useRequireRole } from '@/lib/auth-client'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  section_id?: string | null
}

interface HSCPSection {
  id: string
  section: string
}

export default function AdminStudentAttendancePage() {
  useRequireRole('admin')
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  
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

        // Get unique years in reverse chronological order
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
        // Fetch student
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

        // Fetch section information
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

              // Check if this is an HSCP grade
              const isHSCPGrade = sectionData.grade && sectionData.grade.toUpperCase().startsWith('HSCP')
              
              if (isHSCPGrade) {
                // Fetch all HSCP sections for this grade (Reading, Writing, Conversation)
                const { data: allSections, error: sectionsError } = await supabase
                  .from('sections')
                  .select('id,section')
                  .eq('grade', sectionData.grade)
                  .eq('school_year', yearInput)
                  .in('section', ['Reading', 'Writing', 'Conversation'])
                  .order('section', { ascending: true })

                if (!sectionsError && allSections) {
                  setHscpSections(allSections as HSCPSection[])
                  // Set default tab to first section if available
                  if (allSections.length > 0) {
                    setSelectedHscpTab(allSections[0].section)
                  }
                }
              } else {
                setHscpSections([])
              }

              // Fetch teacher information
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

        // Fetch attendance records (include section_id for HSCP filtering)
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[2.5rem] font-heading font-bold text-[#0f172a] leading-tight mb-3">
          Student Attendance Lookup
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
          />
          {errorMessage ? (
            <p className="mt-3 text-sm text-destructive">{errorMessage}</p>
          ) : null}
          {studentIdInput && availableYears.length === 0 && !errorMessage ? (
            <p className="mt-3 text-sm text-destructive">
              No attendance records found for student ID {studentIdInput}. Please verify the student
              ID.
            </p>
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
              {teacherName && (
                <p className="text-sm text-[#64748b]">Teacher: {teacherName}</p>
              )}
            </div>
          </div>

          {attendance.length > 0 || student ? (
            <div className="space-y-4">
              <h4 className="text-xl font-heading font-semibold text-[#0f172a]">
                Attendance History
              </h4>
              
              {/* Show tabs for HSCP students */}
              {hscpSections.length > 0 ? (
                <div className="space-y-4">
                  {/* Tab buttons */}
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
                  
                  {/* Filtered attendance for selected tab */}
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
                /* Regular attendance display for non-HSCP students */
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
    </div>
  )
}
