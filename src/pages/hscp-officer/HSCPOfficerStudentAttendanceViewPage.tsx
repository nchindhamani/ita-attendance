import { useEffect, useState, useMemo, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useRequireRole } from '@/lib/auth-client'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { formatPacificDate } from '@/lib/time'
import { getCurrentSchoolYear } from '@/lib/school-year'
import { useWorkingDays } from '@/lib/use-working-days'
import { formatIsoAsMdY } from '@/lib/working-days'
import type { AttendanceStatus } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DateInput } from '@/components/ui/date-input'
import { AttendanceStatistics } from '@/features/attendance/AttendanceStatistics'
import Papa from 'papaparse'
import { toast } from 'sonner'
import { Download } from 'lucide-react'

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

// Per-grade data bundle
interface GradeData {
  grade: string
  sections: HSCPSection[]
  students: Student[]
  // attendance keyed by sectionName -> studentId -> AttendanceRecord
  attendanceBySec: Record<string, Record<string, AttendanceRecord>>
}

const ALL_GRADES = '__ALL__'

export default function HSCPOfficerStudentAttendanceViewPage() {
  useRequireRole('hscp_officer')
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const gradeParam = searchParams.get('grade') || ALL_GRADES
  const dateParam = searchParams.get('date') || ''

  const [loading, setLoading] = useState(true)
  const [availableGrades, setAvailableGrades] = useState<string[]>([])
  const [selectedGrade, setSelectedGrade] = useState<string>(gradeParam)
  const [selectedDate, setSelectedDate] = useState<string>(dateParam || formatPacificDate(new Date()))
  const [schoolYear, setSchoolYear] = useState<string>(getCurrentSchoolYear())

  // For single-grade view
  const [sections, setSections] = useState<HSCPSection[]>([])
  const [selectedTab, setSelectedTab] = useState<string>('')
  const [students, setStudents] = useState<Student[]>([])
  const [attendance, setAttendance] = useState<Record<string, AttendanceRecord>>({})

  // For all-grades view
  const [allGradesData, setAllGradesData] = useState<GradeData[]>([])
  const [gradeTabSelections, setGradeTabSelections] = useState<Record<string, string>>({})
  const [loadingAllGrades, setLoadingAllGrades] = useState(false)

  const today = formatPacificDate(new Date())
  const isAllGrades = selectedGrade === ALL_GRADES

  const { workingDays, pickerMin, pickerMax } = useWorkingDays({
    schoolYear,
    scope: { mode: 'type', calendarType: 'hscp' },
    selectedDate,
    dateParam,
    onDateResolved: (iso) => setSelectedDate(iso),
  })

  const isWorkingDay = workingDays.includes(selectedDate)
  const isFutureDate = selectedDate > today
  const dateLockMessage =
    workingDays.length === 0
      ? `No working days uploaded for the HSCP calendar (${schoolYear}). Upload them under Working Days first.`
      : !isWorkingDay
        ? 'Selected date is not a working day. Choose a listed class day from your upload.'
        : isFutureDate
          ? `This is a future class day (next: ${formatIsoAsMdY(selectedDate)}). You can view it, but saving opens on/after that date.`
          : null

  // Fetch available HSCP grades on mount
  useEffect(() => {
    const fetchGrades = async () => {
      setLoading(true)
      try {
        const currentSchoolYear = getCurrentSchoolYear()
        setSchoolYear(currentSchoolYear)

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

        const gradeSet = new Set<string>()
        ;(sectionsData ?? []).forEach((s) => {
          if (s.grade) gradeSet.add(s.grade)
        })
        const grades = Array.from(gradeSet).sort()
        setAvailableGrades(grades)
      } catch (err) {
        console.error('Error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchGrades()
  }, [])

  // ─── ALL GRADES VIEW ────────────────────────────────────────
  const fetchAllGradesData = useCallback(async () => {
    if (!isAllGrades || availableGrades.length === 0 || !schoolYear || !selectedDate) return

    setLoadingAllGrades(true)
    try {
      const gradeDataList: GradeData[] = []

      for (const grade of availableGrades) {
        // Fetch sections for this grade
        const { data: secData } = await supabase
          .from('sections')
          .select('id,grade,section,school_year')
          .eq('grade', grade)
          .eq('school_year', schoolYear)
          .in('section', ['Reading', 'Writing', 'Conversation'])
          .order('section', { ascending: true })

        const gradeSections = secData ?? []
        if (gradeSections.length === 0) continue

        // Fetch students (shared across all sections of the grade)
        const sectionIds = gradeSections.map(s => s.id)
        const { data: stuData } = await supabase
          .from('students')
          .select('id,full_name,student_identifier')
          .in('section_id', sectionIds)
          .eq('school_year', schoolYear)
          .order('full_name', { ascending: true })

        // Deduplicate students
        const uniqueStudents = new Map<string, Student>()
        ;(stuData ?? []).forEach(s => {
          if (!uniqueStudents.has(s.id)) uniqueStudents.set(s.id, s)
        })
        const studentsList = Array.from(uniqueStudents.values())
        const studentIds = studentsList.map(s => s.id)

        // Fetch attendance for all sections of this grade in one go
        const attendanceBySec: Record<string, Record<string, AttendanceRecord>> = {}
        for (const sec of gradeSections) {
          attendanceBySec[sec.section] = {}

          if (studentIds.length > 0) {
            const { data: attData } = await supabase
              .from('student_attendance')
              .select('student_id,status,comments')
              .eq('attendance_date', selectedDate)
              .eq('section_id', sec.id)
              .in('student_id', studentIds)

            ;(attData ?? []).forEach(entry => {
              attendanceBySec[sec.section][entry.student_id] = {
                student_id: entry.student_id,
                status: entry.status as AttendanceStatus,
                comments: entry.comments ?? null,
              }
            })
          }
        }

        gradeDataList.push({
          grade,
          sections: gradeSections,
          students: studentsList,
          attendanceBySec,
        })
      }

      setAllGradesData(gradeDataList)

      // Initialize tab selections for each grade (default to first section)
      const tabInit: Record<string, string> = {}
      gradeDataList.forEach(gd => {
        if (!gradeTabSelections[gd.grade] && gd.sections.length > 0) {
          tabInit[gd.grade] = gd.sections[0].section
        }
      })
      if (Object.keys(tabInit).length > 0) {
        setGradeTabSelections(prev => ({ ...prev, ...tabInit }))
      }
    } catch (err) {
      console.error('Error fetching all grades data:', err)
    } finally {
      setLoadingAllGrades(false)
    }
  }, [isAllGrades, availableGrades, schoolYear, selectedDate])

  useEffect(() => {
    if (isAllGrades) {
      fetchAllGradesData()
    }
  }, [isAllGrades, fetchAllGradesData])

  // ─── SINGLE GRADE VIEW ──────────────────────────────────────
  // Fetch sections for single selected grade
  useEffect(() => {
    if (isAllGrades || !selectedGrade || !schoolYear) return

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

      if (sectionsList.length > 0) {
        const currentTabStillExists = sectionsList.some(s => s.section === selectedTab)
        if (!currentTabStillExists) {
          setSelectedTab(sectionsList[0].section)
        }
      } else {
        setSelectedTab('')
      }
    }

    fetchSections()
  }, [selectedGrade, schoolYear, isAllGrades])

  // Fetch students for single grade
  useEffect(() => {
    if (isAllGrades || !selectedGrade || !schoolYear || sections.length === 0) {
      if (!isAllGrades) setStudents([])
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

      const uniqueStudents = new Map<string, Student>()
      ;(data ?? []).forEach(s => {
        if (!uniqueStudents.has(s.id)) uniqueStudents.set(s.id, s)
      })

      setStudents(Array.from(uniqueStudents.values()))
    }

    fetchStudents()
  }, [selectedGrade, schoolYear, sections, isAllGrades])

  // Fetch attendance for single grade selected tab
  useEffect(() => {
    if (isAllGrades || !selectedDate || !selectedTab || sections.length === 0 || students.length === 0) {
      if (!isAllGrades) setAttendance({})
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
  }, [selectedDate, selectedTab, sections, students, isAllGrades])

  // Update URL when grade/date changes
  useEffect(() => {
    const params = new URLSearchParams()
    if (selectedGrade && selectedGrade !== ALL_GRADES) params.set('grade', selectedGrade)
    if (selectedGrade === ALL_GRADES) params.set('grade', 'all')
    if (selectedDate) params.set('date', selectedDate)
    navigate(`/hscp-officer/hscp-student-attendance?${params.toString()}`, { replace: true })
  }, [selectedGrade, selectedDate, navigate])

  // ─── STATISTICS ──────────────────────────────────────────────
  // Statistics for single-grade view
  const singleGradeStats = useMemo(() => {
    const counts = { present: 0, absent: 0, late: 0, left_early: 0 }
    students.forEach((student) => {
      const record = attendance[student.id]
      if (record) {
        const status = record.status as keyof typeof counts
        if (status in counts) counts[status]++
      }
    })
    return counts
  }, [students, attendance])

  // Get stats for a grade card in all-grades view
  const getGradeTabStats = (gd: GradeData, sectionName: string) => {
    const counts = { present: 0, absent: 0, late: 0, left_early: 0 }
    const secAtt = gd.attendanceBySec[sectionName] || {}
    gd.students.forEach((student) => {
      const record = secAtt[student.id]
      if (record) {
        const status = record.status as keyof typeof counts
        if (status in counts) counts[status]++
      }
    })
    return counts
  }

  // ─── HANDLERS ────────────────────────────────────────────────
  const handleDateChange = (newDate: string) => {
    if (workingDays.length && !workingDays.includes(newDate)) {
      toast.error('That date is not a working day. Choose a listed class day.')
      return
    }
    setSelectedDate(newDate)
  }

  const handleGradeChange = (grade: string) => {
    setSelectedGrade(grade)
    setSelectedTab('')
  }

  // Download CSV for current single-grade tab
  const handleDownloadCSV = () => {
    if (students.length === 0) {
      toast.error('No students to download.')
      return
    }

    const csvRows = students.map((student) => {
      const record = attendance[student.id]
      return {
        'Grade': selectedGrade,
        'Section': selectedTab,
        'Student Name': student.full_name,
        'Student ID': student.student_identifier ?? '',
        'Attendance Date': selectedDate,
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

  // Download ALL grades, ALL sections attendance in one CSV
  const handleDownloadAllCSV = () => {
    if (allGradesData.length === 0) {
      toast.error('No data to download.')
      return
    }

    const csvRows: Record<string, string | number>[] = []

    allGradesData.forEach((gd) => {
      gd.sections.forEach((sec) => {
        const secAtt = gd.attendanceBySec[sec.section] || {}
        gd.students.forEach((student) => {
          const record = secAtt[student.id]
          csvRows.push({
            'Grade': gd.grade,
            'Section': sec.section,
            'Student Name': student.full_name,
            'Student ID': student.student_identifier ?? '',
            'Attendance Date': selectedDate,
            'Status': record?.status ?? 'No Record',
            'Comments': record?.comments ?? '',
          })
        })
      })
    })

    if (csvRows.length === 0) {
      toast.error('No attendance data to download.')
      return
    }

    const csv = Papa.unparse(csvRows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const filename = `hscp-all-attendance-${selectedDate}.csv`
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('All attendance CSV downloaded successfully.')
  }

  // ─── STATUS RENDERING ───────────────────────────────────────
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

  // ─── STUDENT LIST RENDERER (reusable) ────────────────────────
  const renderStudentList = (
    studentsList: Student[],
    attendanceMap: Record<string, AttendanceRecord>
  ) => {
    if (studentsList.length === 0) {
      return (
        <p className="text-muted-foreground text-center py-4">
          No students found.
        </p>
      )
    }

    return (
      <div className="space-y-3">
        {studentsList.map((student) => {
          const record = attendanceMap[student.id]
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
    )
  }

  // ─── RENDER ──────────────────────────────────────────────────
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
          View Student Attendance
        </h2>
        <p className="text-base text-muted-foreground mt-1">
          View student attendance for HSCP grades by date and section.
        </p>
      </div>

      {/* Grade Dropdown Card */}
      <Card className="border border-[#e5e7eb] shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:translate-y-[-4px] hover:shadow-[0_12px_24px_rgba(0,0,0,0.10)] hover:border-[#6366f1]">
        <CardHeader className="px-4 pt-3 pb-1">
          <CardTitle className="text-lg mb-0 leading-none">HSCP Grade</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <select
            value={selectedGrade}
            onChange={(e) => handleGradeChange(e.target.value)}
            className="flex h-10 w-full sm:w-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value={ALL_GRADES}>All Grades</option>
            {availableGrades.map((grade) => (
              <option key={grade} value={grade}>
                {grade}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {/* Pick a Date Card */}
      <Card className="border border-[#e5e7eb] shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:translate-y-[-4px] hover:shadow-[0_12px_24px_rgba(0,0,0,0.10)] hover:border-[#6366f1]">
        <CardHeader className="px-4 pt-3 pb-1">
          <CardTitle className="text-lg mb-0 leading-none">Pick a date</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-1.5">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1 sm:max-w-[180px]">
              <DateInput
                value={selectedDate}
                min={pickerMin}
                max={pickerMax}
                allowedDates={workingDays.length > 0 ? workingDays : undefined}
                onDisallowedDate={() => {
                  toast.error('That date is not a working day. Choose a listed class day.')
                }}
                onChange={(newDate) => handleDateChange(newDate)}
                className="w-full"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              {isAllGrades ? (
                <Button
                  onClick={handleDownloadAllCSV}
                  variant="outline"
                  disabled={allGradesData.length === 0 || loadingAllGrades}
                  className="w-full sm:w-auto"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download All Students Attendance
                </Button>
              ) : (
                <Button
                  onClick={handleDownloadCSV}
                  variant="outline"
                  disabled={students.length === 0}
                  className="w-full sm:w-auto"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download CSV
                </Button>
              )}
            </div>
          </div>
          {dateLockMessage ? (
            <p className="text-sm text-amber-700 leading-snug whitespace-nowrap overflow-x-auto">
              {dateLockMessage}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* ─── ALL GRADES VIEW ─────────────────────────── */}
      {isAllGrades && (
        <>
          {loadingAllGrades ? (
            <div className="flex items-center justify-center p-8">
              <p className="text-muted-foreground">Loading all grades...</p>
            </div>
          ) : allGradesData.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground text-center">
                  No HSCP attendance data found for {selectedDate}.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {allGradesData.map((gd) => {
                const activeSecTab = gradeTabSelections[gd.grade] || (gd.sections[0]?.section ?? '')
                const secAtt = gd.attendanceBySec[activeSecTab] || {}
                const tabStats = getGradeTabStats(gd, activeSecTab)

                return (
                  <Card
                    key={gd.grade}
                    className="border border-[#e5e7eb] shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xl font-bold text-[#0f172a]">
                        {gd.grade}
                        <span className="text-sm font-normal text-muted-foreground ml-2">
                          ({gd.students.length} student{gd.students.length !== 1 ? 's' : ''})
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {/* Section tabs within this grade card */}
                      {gd.sections.length > 0 ? (
                        <div className="space-y-4">
                          <div className="flex gap-2 border-b border-gray-200">
                            {gd.sections.map((sec) => (
                              <button
                                key={sec.id}
                                onClick={() =>
                                  setGradeTabSelections(prev => ({
                                    ...prev,
                                    [gd.grade]: sec.section,
                                  }))
                                }
                                className={`px-4 py-2 font-medium text-sm transition-colors ${
                                  activeSecTab === sec.section
                                    ? 'border-b-2 border-[#6366f1] text-[#6366f1]'
                                    : 'text-[#64748b] hover:text-[#0f172a]'
                                }`}
                              >
                                {sec.section}
                              </button>
                            ))}
                          </div>

                          {/* Statistics for this grade's active tab */}
                          <AttendanceStatistics counts={tabStats} />

                          {/* Student list for this grade's active tab */}
                          {renderStudentList(gd.students, secAtt)}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-center py-4">
                          No sections found for {gd.grade}.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ─── SINGLE GRADE VIEW ───────────────────────── */}
      {!isAllGrades && selectedGrade && (
        <>
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
              <AttendanceStatistics counts={singleGradeStats} />

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
                renderStudentList(students, attendance)
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
