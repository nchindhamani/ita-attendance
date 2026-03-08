import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useRequireActiveProfile } from '@/lib/auth-client'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { formatPacificDate } from '@/lib/time'
import type { AttendanceStatus } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DateInput } from '@/components/ui/date-input'
import { AttendanceStatistics } from '@/features/attendance/AttendanceStatistics'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import Papa from 'papaparse'

const supabase = createSupabaseBrowserClient()

const ALL_GRADES = '__ALL__'

type ViewMode = 'all' | 'teachers' | 'students'

type Teacher = {
  id: string
  full_name: string
  email: string | null
  grade: string | null
  section: string | null
}

type Holiday = {
  holiday_date: string
  name: string
}

type TeacherAttendanceRecord = {
  status: AttendanceStatus
  comments?: string | null
}

type SectionRecord = {
  id: string
  grade: string
  section: string
  school_year: string
}

type Student = {
  id: string
  full_name: string
  student_identifier: number | null
}

type StudentAttendanceRecord = {
  student_id: string
  status: AttendanceStatus
  comments: string | null
}

type GradeStudentData = {
  grade: string
  sections: SectionRecord[]
  students: Student[]
  /** Students grouped by section name — used for non-HSCP grades where each section has different students */
  studentsBySec: Record<string, Student[]>
  attendanceBySec: Record<string, Record<string, StudentAttendanceRecord>>
}

// ─── Status styles ──────────────────────────────────────
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

/** Format grade for display: HSCP grades stay as-is, others get "Grade " prefix */
function formatGradeDisplay(grade: string): string {
  if (grade.toUpperCase().startsWith('HSCP')) return grade
  return `Grade ${grade}`
}

// ─── Props ──────────────────────────────────────────────
export interface ViewAttendancePageProps {
  /** Only show HSCP grades (true) or all grades (false) */
  hscpOnly?: boolean
  /** Base URL path for URL syncing, e.g. "/hscp-officer/teacher-attendance" */
  basePath: string
  /** Page title */
  title: string
  /** Page subtitle */
  subtitle: string
  /** Label for grade dropdown, e.g. "HSCP Grade" or "Grade" */
  gradeLabel?: string
  /** Prefix for CSV file names */
  csvPrefix?: string
  /** Message when no data found */
  emptyMessage?: string
}

export default function ViewAttendancePage({
  hscpOnly = false,
  basePath,
  title,
  subtitle,
  gradeLabel = hscpOnly ? 'HSCP Grade' : 'Grade',
  csvPrefix = hscpOnly ? 'hscp-attendance' : 'attendance',
  emptyMessage = hscpOnly
    ? 'No HSCP teachers found. Please ensure HSCP teachers are created and approved.'
    : 'No teachers or grades found.',
}: ViewAttendancePageProps) {
  const { profile, loading: authLoading } = useRequireActiveProfile()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const dateParam = searchParams.get('date')
  const gradeParam = searchParams.get('grade') || ALL_GRADES

  const [initialLoading, setInitialLoading] = useState(true)
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [teacherAttendance, setTeacherAttendance] = useState<Record<string, TeacherAttendanceRecord>>({})
  const [holiday, setHoliday] = useState<Holiday | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [schoolYear, setSchoolYear] = useState<string>('2025-2026')
  const [selectedDate, setSelectedDate] = useState<string>(dateParam || formatPacificDate(new Date()))
  const [selectedGrade, setSelectedGrade] = useState<string>(gradeParam === 'all' ? ALL_GRADES : gradeParam)
  const [viewMode, setViewMode] = useState<ViewMode>('all')

  // Student data
  const [studentDataByGrade, setStudentDataByGrade] = useState<GradeStudentData[]>([])
  const [studentTabSelections, setStudentTabSelections] = useState<Record<string, string>>({})
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [allGradesFromSections, setAllGradesFromSections] = useState<string[]>([])

  const teachersLoadedRef = useRef(false)
  const cachedSchoolYearRef = useRef<string>('2025-2026')

  const today = formatPacificDate(new Date())
  const isAllGrades = selectedGrade === ALL_GRADES
  const showTeachers = viewMode === 'all' || viewMode === 'teachers'
  const showStudents = viewMode === 'all' || viewMode === 'students'

  // ─── Derived data ──────────────────────────────────────
  const teacherGrades = useMemo(() => {
    const grades = new Set<string>()
    teachers.forEach((t) => {
      if (t.grade) grades.add(t.grade)
    })
    return grades
  }, [teachers])

  const availableGrades = useMemo(() => {
    const grades = new Set<string>(teacherGrades)
    allGradesFromSections.forEach((g) => grades.add(g))
    return Array.from(grades).sort()
  }, [teacherGrades, allGradesFromSections])

  const teachersByGrade = useMemo(() => {
    const map: Record<string, Teacher[]> = {}
    teachers.forEach((t) => {
      const grade = t.grade || 'Unknown'
      if (!map[grade]) map[grade] = []
      map[grade].push(t)
    })
    return map
  }, [teachers])

  // ─── URL sync ──────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams()
    if (selectedGrade === ALL_GRADES) params.set('grade', 'all')
    else if (selectedGrade) params.set('grade', selectedGrade)
    if (selectedDate) params.set('date', selectedDate)
    navigate(`${basePath}?${params.toString()}`, { replace: true })
  }, [selectedGrade, selectedDate, navigate, basePath])

  // ─── Fetch teacher attendance for a date ───────────────
  const fetchAttendanceForDate = useCallback(
    async (date: string, currentSchoolYear: string) => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (!session?.access_token) return

        // Check for holiday
        const { data: holidayData } = await supabase
          .from('holidays')
          .select('holiday_date,name')
          .eq('school_year', currentSchoolYear)
          .eq('holiday_date', date)
          .maybeSingle()

        setHoliday(holidayData || null)

        // Fetch existing attendance via API
        const response = await fetch(`/api/teacher-attendance?date=${date}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          console.error('Error fetching teacher attendance')
          return
        }

        const data = await response.json()
        const existingMap: Record<string, TeacherAttendanceRecord> = {}

        if (data.attendance && Array.isArray(data.attendance)) {
          data.attendance.forEach((entry: any) => {
            if (entry && entry.teacher_id) {
              existingMap[entry.teacher_id] = {
                status: entry.status as AttendanceStatus,
                comments: entry.comments ?? null,
              }
            }
          })
        }

        setTeacherAttendance(existingMap)
      } catch (err) {
        console.error('Error fetching attendance:', err)
      }
    },
    []
  )

  // ─── Fetch student data for grades ─────────────────────
  const fetchStudentData = useCallback(
    async (date: string, currentSchoolYear: string, grades: string[]) => {
      if (grades.length === 0) return

      setLoadingStudents(true)
      try {
        const gradeDataList: GradeStudentData[] = []

        for (const grade of grades) {
          // For HSCP grades (regardless of mode), always filter to Reading/Writing/Conversation sections;
          // for regular grades, fetch all sections for the grade.
          const isHSCPGrade = grade.toUpperCase().startsWith('HSCP')
          let query = supabase
            .from('sections')
            .select('id,grade,section,school_year')
            .eq('grade', grade)
            .eq('school_year', currentSchoolYear)
            .order('section', { ascending: true })

          if (isHSCPGrade) {
            query = query.in('section', ['Reading', 'Writing', 'Conversation'])
          }

          const { data: secData } = await query

          const gradeSections = secData ?? []
          if (gradeSections.length === 0) continue

          // Fetch students per section individually so we know which students belong to which section
          const studentsBySec: Record<string, Student[]> = {}
          const allStudentsMap = new Map<string, Student>()
          const attendanceBySec: Record<string, Record<string, StudentAttendanceRecord>> = {}

          for (const sec of gradeSections) {
            const { data: stuData } = await supabase
              .from('students')
              .select('id,full_name,student_identifier')
              .eq('section_id', sec.id)
              .eq('school_year', currentSchoolYear)
              .order('full_name', { ascending: true })

            const sectionStudents = stuData ?? []
            studentsBySec[sec.section] = sectionStudents
            sectionStudents.forEach((s) => {
              if (!allStudentsMap.has(s.id)) allStudentsMap.set(s.id, s)
            })

            // Fetch attendance for this section
            attendanceBySec[sec.section] = {}
            const secStudentIds = sectionStudents.map((s) => s.id)
            if (secStudentIds.length > 0) {
              const { data: attData } = await supabase
                .from('student_attendance')
                .select('student_id,status,comments')
                .eq('attendance_date', date)
                .eq('section_id', sec.id)
                .in('student_id', secStudentIds)

              ;(attData ?? []).forEach((entry) => {
                attendanceBySec[sec.section][entry.student_id] = {
                  student_id: entry.student_id,
                  status: entry.status as AttendanceStatus,
                  comments: entry.comments ?? null,
                }
              })
            }
          }

          const studentsList = Array.from(allStudentsMap.values())

          gradeDataList.push({
            grade,
            sections: gradeSections,
            students: studentsList,
            studentsBySec,
            attendanceBySec,
          })
        }

        setStudentDataByGrade(gradeDataList)

        const tabInit: Record<string, string> = {}
        gradeDataList.forEach((gd) => {
          if (!studentTabSelections[gd.grade] && gd.sections.length > 0) {
            tabInit[gd.grade] = gd.sections[0].section
          }
        })
        if (Object.keys(tabInit).length > 0) {
          setStudentTabSelections((prev) => ({ ...prev, ...tabInit }))
        }
      } catch (err) {
        console.error('Error fetching student data:', err)
      } finally {
        setLoadingStudents(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hscpOnly]
  )

  // ─── Initial load: fetch teachers & grades ─────────────
  useEffect(() => {
    if (authLoading || !profile) return
    if (teachersLoadedRef.current) return

    const fetchInitialData = async () => {
      setInitialLoading(true)
      setError(null)

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (!session?.access_token) throw new Error('Not authenticated')

        const { data: settings } = await supabase
          .from('system_settings')
          .select('current_school_year')
          .eq('id', 1)
          .maybeSingle()

        const currentSchoolYear = settings?.current_school_year || '2025-2026'
        setSchoolYear(currentSchoolYear)
        cachedSchoolYearRef.current = currentSchoolYear

        const response = await fetch('/api/admin/users', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to fetch teachers' }))
          throw new Error(errorData.error || 'Failed to fetch teachers')
        }

        const data = await response.json()
        const allUsers = data.users || []

        const filteredTeachers = allUsers
          .filter((user: any) => {
            if (user.role !== 'teacher' || !user.is_approved) return false
            if (hscpOnly) {
              const grade = user.grade?.toUpperCase() || ''
              return grade.startsWith('HSCP')
            }
            return true
          })
          .map((user: any) => ({
            id: user.id,
            full_name: user.full_name || '',
            email: user.email,
            grade: user.grade || null,
            section: user.section || null,
          }))

        setTeachers(filteredTeachers)
        teachersLoadedRef.current = true

        // Fetch grades from sections table
        let sectionQuery = supabase
          .from('sections')
          .select('grade')
          .eq('school_year', currentSchoolYear)

        if (hscpOnly) {
          sectionQuery = sectionQuery.ilike('grade', 'HSCP%')
        }

        const { data: sectionGrades } = await sectionQuery

        if (sectionGrades) {
          const uniqueGrades = Array.from(new Set(sectionGrades.map((s: { grade: string }) => s.grade)))
          setAllGradesFromSections(uniqueGrades)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setInitialLoading(false)
      }
    }

    fetchInitialData()
  }, [profile, authLoading, hscpOnly])

  // ─── Fetch teacher attendance when date changes ────────
  useEffect(() => {
    if (!teachersLoadedRef.current || teachers.length === 0) return
    fetchAttendanceForDate(selectedDate, cachedSchoolYearRef.current)
  }, [selectedDate, teachers, fetchAttendanceForDate])

  // ─── Fetch student data when needed ────────────────────
  useEffect(() => {
    if (!showStudents || availableGrades.length === 0 || !schoolYear) return
    const gradesToFetch = isAllGrades ? availableGrades : [selectedGrade]
    fetchStudentData(selectedDate, schoolYear, gradesToFetch)
  }, [showStudents, selectedDate, schoolYear, availableGrades, selectedGrade, isAllGrades, fetchStudentData])

  // ─── Statistics helpers ────────────────────────────────
  const getStatsForTeachers = useCallback(
    (teacherIds: string[]) => {
      const counts = { present: 0, absent: 0, late: 0, left_early: 0 }
      teacherIds.forEach((tid) => {
        const record = teacherAttendance[tid]
        if (record) {
          const status = record.status as keyof typeof counts
          if (status in counts) counts[status] += 1
        }
      })
      return counts
    },
    [teacherAttendance]
  )

  const getStudentStats = useCallback(
    (students: Student[], attendanceMap: Record<string, StudentAttendanceRecord>) => {
      const counts = { present: 0, absent: 0, late: 0, left_early: 0 }
      students.forEach((student) => {
        const record = attendanceMap[student.id]
        if (record) {
          const status = record.status as keyof typeof counts
          if (status in counts) counts[status]++
        }
      })
      return counts
    },
    []
  )

  // ─── Handlers ──────────────────────────────────────────
  const handleDateChange = (newDate: string) => {
    if (newDate > today) return
    setSelectedDate(newDate)
  }

  const handleGradeChange = (grade: string) => {
    setSelectedGrade(grade)
  }

  const handleDownloadCSV = () => {
    const csvRows: Record<string, string | number>[] = []

    if (showTeachers) {
      const targetTeachers = isAllGrades ? teachers : teachersByGrade[selectedGrade] || []
      targetTeachers.forEach((teacher) => {
        const record = teacherAttendance[teacher.id]
        const row: Record<string, string | number> = {
          Type: 'Teacher',
          Grade: teacher.grade || '',
          Section: teacher.section || '',
          Name: teacher.full_name,
          'Teacher Email': teacher.email || '',
        }
        if (showStudents) row['Student ID'] = ''
        row['Attendance Date'] = selectedDate
        row['Status'] = record?.status || 'No Record'
        row['Comments'] = record?.comments ?? ''
        csvRows.push(row)
      })
    }

    if (showStudents) {
      const gradesToExport = isAllGrades ? availableGrades : [selectedGrade]
      gradesToExport.forEach((grade) => {
        const gd = studentDataByGrade.find((g) => g.grade === grade)
        if (!gd) return
        gd.sections.forEach((sec) => {
          const secAtt = gd.attendanceBySec[sec.section] || {}
          // Use per-section students to avoid duplicates across sections
          const secStudents = gd.studentsBySec[sec.section] ?? gd.students
          secStudents.forEach((student) => {
            const record = secAtt[student.id]
            const row: Record<string, string | number> = {
              Type: 'Student',
              Grade: gd.grade,
              Section: sec.section,
              Name: student.full_name,
            }
            if (showTeachers) row['Teacher Email'] = ''
            row['Student ID'] = student.student_identifier ?? ''
            row['Attendance Date'] = selectedDate
            row['Status'] = record?.status ?? 'No Record'
            row['Comments'] = record?.comments ?? ''
            csvRows.push(row)
          })
        })
      })
    }

    if (csvRows.length === 0) {
      toast.error('No data to download.')
      return
    }

    const csv = Papa.unparse(csvRows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const gradeStr = isAllGrades ? 'all-grades' : selectedGrade
    const viewLabel = viewMode === 'all' ? 'all' : viewMode
    link.setAttribute('download', `${csvPrefix}-${viewLabel}-${gradeStr}-${selectedDate}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('CSV downloaded successfully.')
  }

  // ─── View-only teacher card renderer ───────────────────
  const renderTeacherCard = (teacher: Teacher) => {
    const record = teacherAttendance[teacher.id]
    const status = record?.status
    const comments = record?.comments

    return (
      <div
        key={teacher.id}
        className="rounded-[12px] border border-[#e5e7eb] bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:translate-y-[-8px] hover:shadow-[0_20px_40px_rgba(0,0,0,0.12)] hover:border-[#6366f1]"
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="font-semibold text-[#0f172a] text-base">{teacher.full_name}</p>
            <p className="text-xs text-[#64748b] mt-0.5">
              {teacher.grade && teacher.section ? `${teacher.grade} - ${teacher.section}` : teacher.email || ''}
            </p>
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
          <div className="mt-2 text-sm text-[#64748b]">{comments}</div>
        )}
      </div>
    )
  }

  // ─── View-only student card renderer ───────────────────
  const renderStudentList = (studentsList: Student[], attendanceMap: Record<string, StudentAttendanceRecord>) => {
    if (studentsList.length === 0) {
      return <p className="text-muted-foreground text-center py-4">No students found.</p>
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
                  <span className="font-medium text-[#0f172a]">{student.full_name}</span>
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
                <div className="mt-2 text-sm text-[#64748b] pl-11">{comments}</div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // ─── Student section with tabs renderer ────────────────
  const renderStudentSection = (grade: string) => {
    const gradeData = studentDataByGrade.find((g) => g.grade === grade)

    if (loadingStudents) {
      return (
        <div className="text-center py-4">
          <p className="text-muted-foreground text-sm">Loading students...</p>
        </div>
      )
    }

    if (!gradeData || gradeData.sections.length === 0) {
      return (
        <p className="text-muted-foreground text-center py-4 text-sm">
          No student sections found for {formatGradeDisplay(grade)}.
        </p>
      )
    }

    const activeTab = studentTabSelections[grade] || gradeData.sections[0]?.section || ''
    const secAtt = gradeData.attendanceBySec[activeTab] || {}
    // Use section-specific student list; for HSCP grades (shared students) fall back to full list
    const activeStudents = gradeData.studentsBySec[activeTab] ?? gradeData.students
    const tabStats = getStudentStats(activeStudents, secAtt)

    return (
      <div className="space-y-4">
        {gradeData.sections.length > 1 && (
          <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
            {gradeData.sections.map((sec) => {
              const secStudents = gradeData.studentsBySec[sec.section] ?? gradeData.students
              return (
                <button
                  key={sec.id}
                  onClick={() =>
                    setStudentTabSelections((prev) => ({ ...prev, [grade]: sec.section }))
                  }
                  className={`px-4 py-2 font-medium text-sm transition-colors whitespace-nowrap ${
                    activeTab === sec.section
                      ? 'border-b-2 border-[#6366f1] text-[#6366f1]'
                      : 'text-[#64748b] hover:text-[#0f172a]'
                  }`}
                >
                  {sec.section} ({secStudents.length})
                </button>
              )
            })}
          </div>
        )}
        <AttendanceStatistics counts={tabStats} />
        {renderStudentList(activeStudents, secAtt)}
      </div>
    )
  }

  // ─── Grade card renderer ───────────────────────────────
  const renderGradeCard = (grade: string) => {
    const gradeTeachers = teachersByGrade[grade] || []
    const gradeTeacherIds = gradeTeachers.map((t) => t.id)
    const gradeTeacherStats = getStatsForTeachers(gradeTeacherIds)

    return (
      <Card key={grade} className="border border-[#e5e7eb] shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl font-bold text-[#0f172a]">{formatGradeDisplay(grade)}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-6">
            {showTeachers && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-[#0f172a] border-b border-gray-200 pb-2">
                  Teachers
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    ({gradeTeachers.length})
                  </span>
                </h3>
                {gradeTeachers.length > 0 ? (
                  <>
                    <AttendanceStatistics counts={gradeTeacherStats} />
                    <div className="space-y-3">
                      {gradeTeachers.map((t) => renderTeacherCard(t))}
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground text-center py-4">
                    No teachers found for {formatGradeDisplay(grade)}.
                  </p>
                )}
              </div>
            )}

            {showStudents && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-[#0f172a] border-b border-gray-200 pb-2">
                  Students
                  {studentDataByGrade.find((g) => g.grade === grade) && (
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      ({studentDataByGrade.find((g) => g.grade === grade)?.students.length ?? 0})
                    </span>
                  )}
                </h3>
                <Card className="border border-[#e2e8f0] bg-[#f8fafc] shadow-sm">
                  <CardContent className="pt-4">
                    {renderStudentSection(grade)}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  // ─── Loading / Error states ────────────────────────────
  if (authLoading || initialLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader><CardTitle>Error</CardTitle></CardHeader>
        <CardContent><p className="text-destructive">{error}</p></CardContent>
      </Card>
    )
  }

  if (teachers.length === 0 && availableGrades.length === 0 && !initialLoading) {
    return (
      <div className="space-y-3">
        <div>
          <h2 className="text-[2.5rem] font-heading font-bold text-[#0f172a] leading-tight">
            {title}
          </h2>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">
              {emptyMessage}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ─── Single grade view ─────────────────────────────────
  const renderSingleGradeView = () => {
    const gradeTeachers = teachersByGrade[selectedGrade] || []
    const gradeTeacherIds = gradeTeachers.map((t) => t.id)
    const gradeTeacherStats = getStatsForTeachers(gradeTeacherIds)

    return (
      <div className="space-y-6">
        {showTeachers && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-[#0f172a] border-b border-gray-200 pb-2">
              Teachers
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({gradeTeachers.length})
              </span>
            </h3>
            {gradeTeachers.length > 0 ? (
              <>
                <AttendanceStatistics counts={gradeTeacherStats} />
                <div className="space-y-3">
                  {gradeTeachers.map((t) => renderTeacherCard(t))}
                </div>
              </>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-muted-foreground text-center">
                    No teachers found for {formatGradeDisplay(selectedGrade)}.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {showStudents && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-[#0f172a] border-b border-gray-200 pb-2">
              Students
              {studentDataByGrade.find((g) => g.grade === selectedGrade) && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({studentDataByGrade.find((g) => g.grade === selectedGrade)?.students.length ?? 0})
                </span>
              )}
            </h3>
            <Card className="border border-[#e2e8f0] bg-[#f8fafc] shadow-sm">
              <CardContent className="pt-4">
                {renderStudentSection(selectedGrade)}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    )
  }

  // ─── Main render ───────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-[2.5rem] font-heading font-bold text-[#0f172a] leading-tight">
          {title}
        </h2>
        <p className="text-base text-muted-foreground mt-1">
          {subtitle}
        </p>
      </div>

      {/* School Year */}
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">School year: {schoolYear}</p>
        {holiday && (
          <p className="text-sm text-emerald-600">
            Holiday: {holiday.name}. No attendance recorded.
          </p>
        )}
      </div>

      {/* Dropdowns Row: Grade + View Mode */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border border-[#e5e7eb] shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:translate-y-[-4px] hover:shadow-[0_12px_24px_rgba(0,0,0,0.10)] hover:border-[#6366f1]">
          <CardHeader className="px-4 pt-3 pb-1">
            <CardTitle className="text-lg mb-0 leading-none">{gradeLabel}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <select
              value={selectedGrade}
              onChange={(e) => handleGradeChange(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value={ALL_GRADES}>All Grades</option>
              {availableGrades.map((grade) => (
                <option key={grade} value={grade}>{formatGradeDisplay(grade)}</option>
              ))}
            </select>
          </CardContent>
        </Card>

        <Card className="border border-[#e5e7eb] shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:translate-y-[-4px] hover:shadow-[0_12px_24px_rgba(0,0,0,0.10)] hover:border-[#6366f1]">
          <CardHeader className="px-4 pt-3 pb-1">
            <CardTitle className="text-lg mb-0 leading-none">View</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as ViewMode)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="all">All Teachers & Students</option>
              <option value="teachers">Teachers</option>
              <option value="students">Students</option>
            </select>
          </CardContent>
        </Card>
      </div>

      {/* Pick a Date Card with Download button */}
      <Card className="border border-[#e5e7eb] shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:translate-y-[-4px] hover:shadow-[0_12px_24px_rgba(0,0,0,0.10)] hover:border-[#6366f1]">
        <CardHeader className="px-4 pt-3 pb-1">
          <CardTitle className="text-lg mb-0 leading-none">Pick a date</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1 sm:max-w-[180px]">
              <DateInput
                value={selectedDate}
                max={today}
                onChange={(newDate) => handleDateChange(newDate)}
                className="w-full"
              />
            </div>
            <Button onClick={handleDownloadCSV} variant="outline" className="w-full sm:w-auto">
              <Download className="w-4 h-4 mr-2" />
              Download CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ALL GRADES VIEW */}
      {isAllGrades && (
        <>
          {availableGrades.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground text-center">No grades found.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {availableGrades.map((grade) => renderGradeCard(grade))}
            </div>
          )}
        </>
      )}

      {/* SINGLE GRADE VIEW */}
      {!isAllGrades && selectedGrade && renderSingleGradeView()}
    </div>
  )
}

