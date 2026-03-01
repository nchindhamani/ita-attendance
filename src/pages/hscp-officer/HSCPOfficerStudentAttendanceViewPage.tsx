import { useEffect, useState, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useRequireRole } from '@/lib/auth-client'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { formatPacificDate } from '@/lib/time'
import type { AttendanceStatus } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AttendanceStatistics } from '@/features/attendance/AttendanceStatistics'
import Papa from 'papaparse'
import { toast } from 'sonner'

const supabase = createSupabaseBrowserClient()

interface HSCPSection {
  id: string
  grade: string
  section: string
  school_year: string
}

interface Student {
  id: string
  full_name: string
  student_identifier: number | null
}

interface AttendanceRecord {
  student_id: string
  status: AttendanceStatus
  comments: string | null
}

export default function HSCPOfficerStudentAttendanceViewPage() {
  useRequireRole('hscp_officer')
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const gradeParam = searchParams.get('grade') || ''
  const dateParam = searchParams.get('date') || ''

  const [loading, setLoading] = useState(true)
  const [availableGrades, setAvailableGrades] = useState<string[]>([])
  const [selectedGrade, setSelectedGrade] = useState<string>(gradeParam)
  const [selectedDate, setSelectedDate] = useState<string>(dateParam || formatPacificDate(new Date()))
  const [sections, setSections] = useState<HSCPSection[]>([])
  const [selectedTab, setSelectedTab] = useState<string>('')
  const [students, setStudents] = useState<Student[]>([])
  const [attendance, setAttendance] = useState<Record<string, AttendanceRecord>>({})
  const [schoolYear, setSchoolYear] = useState<string>('2025-2026')

  const today = formatPacificDate(new Date())

  // Fetch available HSCP grades on mount
  useEffect(() => {
    const fetchGrades = async () => {
      setLoading(true)
      try {
        // Get current school year
        const { data: settings } = await supabase
          .from('system_settings')
          .select('current_school_year')
          .eq('id', 1)
          .maybeSingle()

        const currentSchoolYear = settings?.current_school_year || '2025-2026'
        setSchoolYear(currentSchoolYear)

        // Fetch all HSCP sections to get unique grades
        const { data: sectionsData, error } = await supabase
          .from('sections')
          .select('grade')
          .like('grade', 'HSCP-%')
          .eq('school_year', currentSchoolYear)
          .order('grade', { ascending: true })

        if (error) {
          console.error('Error fetching HSCP grades:', error)
          setLoading(false)
          return
        }

        // Get unique grades
        const gradeSet = new Set<string>()
        ;(sectionsData ?? []).forEach((s) => {
          if (s.grade) gradeSet.add(s.grade)
        })
        const grades = Array.from(gradeSet).sort()
        setAvailableGrades(grades)

        // Auto-select first grade if none selected
        if (!gradeParam && grades.length > 0) {
          setSelectedGrade(grades[0])
        }
      } catch (err) {
        console.error('Error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchGrades()
  }, [gradeParam])

  // Fetch sections for selected grade
  useEffect(() => {
    if (!selectedGrade || !schoolYear) return

    const fetchSections = async () => {
      const { data, error } = await supabase
        .from('sections')
        .select('id,grade,section,school_year')
        .eq('grade', selectedGrade)
        .eq('school_year', schoolYear)
        .in('section', ['Reading', 'Writing', 'Conversation'])
        .order('section', { ascending: true })

      if (error) {
        console.error('Error fetching sections:', error)
        return
      }

      const sectionsList = data ?? []
      setSections(sectionsList)

      // Set default tab
      if (sectionsList.length > 0) {
        // Try to keep the current tab if it still exists
        const currentTabStillExists = sectionsList.some(s => s.section === selectedTab)
        if (!currentTabStillExists) {
          setSelectedTab(sectionsList[0].section)
        }
      } else {
        setSelectedTab('')
      }
    }

    fetchSections()
  }, [selectedGrade, schoolYear])

  // Fetch students for grade (shared across all sections for HSCP)
  useEffect(() => {
    if (!selectedGrade || !schoolYear || sections.length === 0) {
      setStudents([])
      return
    }

    const fetchStudents = async () => {
      const sectionIds = sections.map(s => s.id)

      const { data, error } = await supabase
        .from('students')
        .select('id,full_name,student_identifier')
        .in('section_id', sectionIds)
        .eq('school_year', schoolYear)
        .order('full_name', { ascending: true })

      if (error) {
        console.error('Error fetching students:', error)
        return
      }

      // Deduplicate students (they might be in multiple sections)
      const uniqueStudents = new Map<string, Student>()
      ;(data ?? []).forEach(s => {
        if (!uniqueStudents.has(s.id)) {
          uniqueStudents.set(s.id, s)
        }
      })

      setStudents(Array.from(uniqueStudents.values()))
    }

    fetchStudents()
  }, [selectedGrade, schoolYear, sections])

  // Fetch attendance for selected date and tab (section)
  useEffect(() => {
    if (!selectedDate || !selectedTab || sections.length === 0 || students.length === 0) {
      setAttendance({})
      return
    }

    const fetchAttendance = async () => {
      const currentSection = sections.find(s => s.section === selectedTab)
      if (!currentSection) return

      const studentIds = students.map(s => s.id)

      const { data, error } = await supabase
        .from('student_attendance')
        .select('student_id,status,comments')
        .eq('attendance_date', selectedDate)
        .eq('section_id', currentSection.id)
        .in('student_id', studentIds)

      if (error) {
        console.error('Error fetching attendance:', error)
        return
      }

      const attendanceMap = (data ?? []).reduce(
        (acc, entry) => {
          acc[entry.student_id] = {
            student_id: entry.student_id,
            status: entry.status as AttendanceStatus,
            comments: entry.comments ?? null,
          }
          return acc
        },
        {} as Record<string, AttendanceRecord>
      )

      setAttendance(attendanceMap)
    }

    fetchAttendance()
  }, [selectedDate, selectedTab, sections, students])

  // Update URL when grade/date changes
  useEffect(() => {
    if (selectedGrade || selectedDate) {
      const params = new URLSearchParams()
      if (selectedGrade) params.set('grade', selectedGrade)
      if (selectedDate) params.set('date', selectedDate)
      navigate(`/hscp-officer/hscp-student-attendance?${params.toString()}`, { replace: true })
    }
  }, [selectedGrade, selectedDate, navigate])

  // Compute statistics for the currently visible tab
  const statistics = useMemo(() => {
    const counts = { present: 0, absent: 0, late: 0, left_early: 0 }
    students.forEach((student) => {
      const record = attendance[student.id]
      if (record) {
        const status = record.status as keyof typeof counts
        if (status in counts) counts[status]++
      }
      // Students with no record are not counted (no data for that section/date)
    })
    return counts
  }, [students, attendance])

  const handleDateChange = (newDate: string) => {
    if (newDate > today) return
    setSelectedDate(newDate)
  }

  const handleGradeChange = (grade: string) => {
    setSelectedGrade(grade)
    setSelectedTab('')
  }

  const handleDownloadCSV = () => {
    if (students.length === 0) {
      toast.error('No students to download.')
      return
    }

    const csvRows = students.map((student) => {
      const record = attendance[student.id]
      return {
        'Student Name': student.full_name,
        'Student ID': student.student_identifier ?? '',
        'Status': record?.status ?? 'No Record',
        'Comments': record?.comments ?? '',
      }
    })

    const csv = Papa.unparse(csvRows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const filename = `hscp-attendance-${selectedGrade}-${selectedTab}-${selectedDate}.csv`
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('CSV downloaded successfully.')
  }

  // Status badge styling
  const statusStyles: Record<string, string> = {
    present: 'bg-white border-2 border-[#10b981] text-[#10b981]',
    absent: 'bg-white border-2 border-[#ef4444] text-[#ef4444]',
    late: 'bg-white border-2 border-[#f97316] text-[#f97316]',
    left_early: 'bg-white border-2 border-[#8b5cf6] text-[#8b5cf6]',
  }

  const statusLabels: Record<string, string> = {
    present: 'Present',
    absent: 'Absent',
    late: 'Late',
    left_early: 'Left Early',
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-[2.5rem] font-heading font-bold text-[#0f172a] leading-tight">
          HSCP Student Attendance
        </h2>
        <p className="text-base text-muted-foreground mt-1">
          View student attendance for HSCP grades by date and section.
        </p>
      </div>

      {/* Grade Dropdown */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-[#0f172a]">HSCP Grade</label>
          <select
            value={selectedGrade}
            onChange={(e) => handleGradeChange(e.target.value)}
            className="flex h-10 w-full sm:w-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="">Select a grade</option>
            {availableGrades.map((grade) => (
              <option key={grade} value={grade}>
                {grade}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedGrade && (
        <>
          {/* Pick a Date Card */}
          <Card className="border border-[#e5e7eb] shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:translate-y-[-4px] hover:shadow-[0_12px_24px_rgba(0,0,0,0.10)] hover:border-[#6366f1]">
            <CardHeader className="px-4 pt-3 pb-1">
              <CardTitle className="text-lg mb-0 leading-none">Pick a date</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1 sm:max-w-[180px]">
                  <Input
                    type="date"
                    value={selectedDate}
                    max={today}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={handleDownloadCSV}
                    variant="outline"
                    disabled={students.length === 0}
                    className="w-full sm:w-auto"
                  >
                    Download CSV
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section Tabs (Reading, Writing, Conversation) */}
          {sections.length > 0 ? (
            <div className="space-y-4">
              <div className="flex gap-2 border-b border-gray-200">
                {sections.map((sec) => (
                  <button
                    key={sec.id}
                    onClick={() => setSelectedTab(sec.section)}
                    className={`px-4 py-2 font-medium text-sm transition-colors ${
                      selectedTab === sec.section
                        ? 'border-b-2 border-[#6366f1] text-[#6366f1]'
                        : 'text-[#64748b] hover:text-[#0f172a]'
                    }`}
                  >
                    {sec.section}
                  </button>
                ))}
              </div>

              {/* Statistics */}
              <AttendanceStatistics counts={statistics} />

              {/* Student Attendance List */}
              {students.length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-muted-foreground text-center">
                      No students found for {selectedGrade}.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {students.map((student) => {
                    const record = attendance[student.id]
                    const status = record?.status
                    const comments = record?.comments

                    return (
                      <div
                        key={student.id}
                        className="rounded-[12px] border border-[#e5e7eb] bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:translate-y-[-8px] hover:shadow-[0_20px_40px_rgba(0,0,0,0.12)] hover:border-[#6366f1] transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#f1f5f9] flex items-center justify-center text-sm font-semibold text-[#64748b]">
                              {student.student_identifier ?? '?'}
                            </div>
                            <span className="font-medium text-[#0f172a]">
                              {student.full_name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {status ? (
                              <span
                                className={`px-3 py-1.5 rounded-[8px] text-sm font-medium ${
                                  statusStyles[status] || 'bg-white border border-[#e5e7eb] text-[#9ca3af]'
                                }`}
                              >
                                {statusLabels[status] || status}
                              </span>
                            ) : (
                              <span className="px-3 py-1.5 rounded-[8px] text-sm font-medium bg-white border border-[#e5e7eb] text-[#9ca3af]">
                                No Record
                              </span>
                            )}
                          </div>
                        </div>
                        {comments && (
                          <div className="mt-2 text-sm text-[#64748b] pl-11">
                            {comments}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground text-center">
                  No sections found for {selectedGrade}. Ensure Reading, Writing, and Conversation sections exist.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!selectedGrade && availableGrades.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">
              Select an HSCP grade to view student attendance.
            </p>
          </CardContent>
        </Card>
      )}

      {availableGrades.length === 0 && !loading && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">
              No HSCP grades found. Ensure HSCP sections are created.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

