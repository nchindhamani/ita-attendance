import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useRequireActiveProfile } from '@/lib/auth-client'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { formatPacificDate } from '@/lib/time'
import { getCurrentSchoolYear } from '@/lib/school-year'
import {
  calendarTypeForGrade,
  fetchWorkingDays,
  formatIsoAsMdY,
  pickDefaultWorkingDate,
} from '@/lib/working-days'
import type { AttendanceStatus } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AttendanceEditor } from '@/features/attendance/AttendanceEditor'

const supabase = createSupabaseBrowserClient()

type Section = {
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

// type Holiday = {
//   holiday_date: string
//   name: string
// }

export interface RecordStudentAttendancePageProps {
  hscpOnly?: boolean
  basePath?: string
}

export function RecordStudentAttendancePage({
  hscpOnly = true,
  basePath = '/hscp-officer/record-student-attendance',
}: RecordStudentAttendancePageProps) {
  useRequireActiveProfile()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const gradeParam = searchParams.get('grade') || ''
  const sectionParam = searchParams.get('section') || ''
  const dateParam = searchParams.get('date') || ''

  const [initialLoading, setInitialLoading] = useState(true)
  const [availableGrades, setAvailableGrades] = useState<string[]>([])
  const [allSections, setAllSections] = useState<Section[]>([])
  const [filteredSections, setFilteredSections] = useState<Section[]>([])
  const [selectedGrade, setSelectedGrade] = useState<string>(gradeParam)
  const [selectedSectionId, setSelectedSectionId] = useState<string>(sectionParam)
  const [selectedDate, setSelectedDate] = useState<string>(dateParam || formatPacificDate(new Date()))
  const [students, setStudents] = useState<Student[]>([])
  const [existingAttendance, setExistingAttendance] = useState<Record<string, { status: AttendanceStatus; comments?: string | null }>>({})
  // const [holiday, setHoliday] = useState<Holiday | null>(null)
  const [workingDays, setWorkingDays] = useState<string[]>([])
  const [schoolYear, setSchoolYear] = useState<string>(getCurrentSchoolYear())
  const [error, setError] = useState<string | null>(null)

  const studentsLoadedRef = useRef(false)
  const cachedStudentIdsRef = useRef<string[]>([])
  const cachedSectionIdRef = useRef<string>('')
  const workingDaysInitializedRef = useRef(false)

  const today = formatPacificDate(new Date())

  const calendarType = useMemo(() => {
    if (hscpOnly) return 'hscp' as const
    if (selectedGrade) return calendarTypeForGrade(selectedGrade)
    return 'regular' as const
  }, [hscpOnly, selectedGrade])

  useEffect(() => {
    const fetchGradesAndSections = async () => {
      setInitialLoading(true)
      try {
        const currentSchoolYear = getCurrentSchoolYear()
        setSchoolYear(currentSchoolYear)

        let query = supabase
          .from('sections')
          .select('id,grade,section,school_year')
          .eq('school_year', currentSchoolYear)
          .order('grade', { ascending: true })
          .order('section', { ascending: true })

        if (hscpOnly) {
          query = query.like('grade', 'HSCP-%')
        }

        const { data: sectionsData, error: sectionsError } = await query

        if (sectionsError) {
          console.error('Error fetching sections:', sectionsError)
          setInitialLoading(false)
          return
        }

        const sections = sectionsData || []
        setAllSections(sections)

        const grades = [...new Set(sections.map(s => s.grade))].sort()
        setAvailableGrades(grades)

        if (gradeParam && grades.includes(gradeParam)) {
          const filtered = sections.filter(s => s.grade === gradeParam)
          setFilteredSections(filtered)

          if (sectionParam && filtered.some(s => s.id === sectionParam)) {
            await loadStudentsAndAttendance(sectionParam, currentSchoolYear, dateParam || formatPacificDate(new Date()))
          }
        } else if (grades.length > 0 && !gradeParam) {
          const firstGrade = grades[0]
          setSelectedGrade(firstGrade)
          const filtered = sections.filter(s => s.grade === firstGrade)
          setFilteredSections(filtered)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setInitialLoading(false)
      }
    }

    fetchGradesAndSections()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hscpOnly])

  const loadStudentsAndAttendance = async (sectionId: string, year: string, date: string) => {
    try {
      const sectionData = allSections.find(s => s.id === sectionId)
      if (!sectionData) {
        setError('Section not found')
        return
      }

      let sectionIdsToFetch: string[]
      if (hscpOnly) {
        const allGradeSections = allSections.filter(s => s.grade === sectionData.grade)
        sectionIdsToFetch = allGradeSections.map(s => s.id)
      } else {
        sectionIdsToFetch = [sectionId]
      }

      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('id,full_name,student_identifier')
        .in('section_id', sectionIdsToFetch)
        .eq('school_year', year)
        .order('full_name', { ascending: true })

      if (studentsError) {
        console.error('Error fetching students:', studentsError)
        setError('Failed to load students')
        return
      }

      const studentsList = studentsData || []
      let studentIds: string[]
      if (hscpOnly) {
        const uniqueMap = new Map<string, Student>()
        studentsList.forEach((s: Student) => {
          if (!uniqueMap.has(s.id)) uniqueMap.set(s.id, s)
        })
        const uniqueStudents = Array.from(uniqueMap.values())
        setStudents(uniqueStudents)
        studentIds = uniqueStudents.map(s => s.id)
      } else {
        setStudents(studentsList)
        studentIds = studentsList.map((s: Student) => s.id)
      }
      cachedStudentIdsRef.current = studentIds
      cachedSectionIdRef.current = sectionId
      studentsLoadedRef.current = true

      await fetchAttendanceForDate(date, sectionId, studentIds, year)
    } catch (err) {
      console.error('Error loading students:', err)
    }
  }

  useEffect(() => {
    let cancelled = false
    const loadWorkingDays = async () => {
      const dates = await fetchWorkingDays(schoolYear, calendarType)
      if (cancelled) return
      setWorkingDays(dates)
      if (!workingDaysInitializedRef.current) {
        workingDaysInitializedRef.current = true
        const preferred = dateParam || pickDefaultWorkingDate(dates, today)
        if (preferred && preferred !== selectedDate) {
          setSelectedDate(preferred)
        }
      } else if (dates.length && !dates.includes(selectedDate)) {
        const preferred = pickDefaultWorkingDate(dates, today)
        if (preferred) setSelectedDate(preferred)
      }
    }
    loadWorkingDays()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolYear, calendarType])

  const fetchAttendanceForDate = useCallback(async (date: string, sectionId: string, studentIds: string[], year: string) => {
    try {
      // Holiday check disabled — working days allowlist is enforced in UI + API
      // const { data: holidayData } = await supabase
      //   .from('holidays')
      //   .select('holiday_date,name')
      //   .eq('school_year', year)
      //   .eq('holiday_date', date)
      //   .maybeSingle()
      // setHoliday(holidayData || null)

      if (studentIds.length > 0) {
        const { data: attendanceData } = await supabase
          .from('student_attendance')
          .select('student_id,status,comments')
          .eq('attendance_date', date)
          .eq('section_id', sectionId)
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
      } else {
        setExistingAttendance({})
      }
    } catch (err) {
      console.error('Error fetching attendance:', err)
    }
  }, [])

  useEffect(() => {
    if (!studentsLoadedRef.current) return
    if (!cachedSectionIdRef.current) return

    fetchAttendanceForDate(selectedDate, cachedSectionIdRef.current, cachedStudentIdsRef.current, schoolYear)
  }, [selectedDate, fetchAttendanceForDate, schoolYear])

  const updateUrl = (grade: string, section: string, date: string) => {
    const params = new URLSearchParams()
    if (grade) params.set('grade', grade)
    if (section) params.set('section', section)
    if (date) params.set('date', date)
    navigate(`${basePath}?${params.toString()}`, { replace: true })
  }

  const handleGradeChange = (grade: string) => {
    setSelectedGrade(grade)
    setSelectedSectionId('')
    setStudents([])
    setExistingAttendance({})
    studentsLoadedRef.current = false

    const filtered = allSections.filter(s => s.grade === grade)
    setFilteredSections(filtered)
    updateUrl(grade, '', selectedDate)
  }

  const handleSectionChange = async (sectionId: string) => {
    setSelectedSectionId(sectionId)
    studentsLoadedRef.current = false
    updateUrl(selectedGrade, sectionId, selectedDate)

    if (sectionId) {
      await loadStudentsAndAttendance(sectionId, schoolYear, selectedDate)
    } else {
      setStudents([])
      setExistingAttendance({})
    }
  }

  const handleDateChange = (newDate: string) => {
    if (workingDays.length && !workingDays.includes(newDate)) {
      toast.error('That date is not a working day. Choose a listed class day.')
      return
    }
    setSelectedDate(newDate)
    updateUrl(selectedGrade, selectedSectionId, newDate)
  }

  const currentSection = allSections.find(s => s.id === selectedSectionId)
  const isWorkingDay = workingDays.includes(selectedDate)
  const isFutureDate = selectedDate > today
  const lockMessage =
    workingDays.length === 0
      ? `No working days uploaded for the ${calendarType === 'hscp' ? 'HSCP' : 'Regular'} calendar (${schoolYear}). Upload them under Working Days first.`
      : !isWorkingDay
        ? 'Selected date is not a working day. Choose a listed class day from your upload.'
        : isFutureDate
          ? `This is a future class day (next: ${formatIsoAsMdY(selectedDate)}). You can view it, but saving opens on/after that date.`
          : null
  const locked = Boolean(lockMessage)

  if (initialLoading) {
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

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-[2.5rem] font-heading font-bold text-[#0f172a] leading-tight">
          Record Student Attendance
        </h2>
        <p className="text-sm text-muted-foreground">
          School year: {schoolYear}
        </p>
      </div>

      <Card>
        <CardHeader className="px-4 pt-3 pb-0">
          <CardTitle className="text-lg mb-0 leading-none">Select Grade & Section</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pt-3 pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1 sm:max-w-[200px]">
              <label className="text-sm font-medium text-muted-foreground mb-1 block">Grade</label>
              <select
                value={selectedGrade}
                onChange={(e) => handleGradeChange(e.target.value)}
                className="flex h-12 w-full rounded-[10px] border-2 border-input bg-background px-4 py-3 text-sm ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366f1] focus-visible:ring-offset-2 focus-visible:border-[#6366f1]"
              >
                <option value="">Select grade...</option>
                {availableGrades.map((grade) => (
                  <option key={grade} value={grade}>{grade}</option>
                ))}
              </select>
            </div>

            <div className="flex-1 sm:max-w-[200px]">
              <label className="text-sm font-medium text-muted-foreground mb-1 block">Section</label>
              <select
                value={selectedSectionId}
                onChange={(e) => handleSectionChange(e.target.value)}
                disabled={!selectedGrade || filteredSections.length === 0}
                className="flex h-12 w-full rounded-[10px] border-2 border-input bg-background px-4 py-3 text-sm ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366f1] focus-visible:ring-offset-2 focus-visible:border-[#6366f1] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select section...</option>
                {filteredSections.map((sec) => (
                  <option key={sec.id} value={sec.id}>{sec.section}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedSectionId && currentSection ? (
        <AttendanceEditor
          sectionId={selectedSectionId}
          schoolYear={schoolYear}
          attendanceDate={selectedDate}
          students={students}
          existing={existingAttendance}
          locked={locked || isFutureDate}
          holidayName={null}
          lockMessage={lockMessage}
          allowedDates={workingDays}
          schoolYearDisplay={null}
          onDateChange={handleDateChange}
          sectionGrade={currentSection.grade}
          sectionName={currentSection.section}
        />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">
              {!selectedGrade
                ? 'Please select a grade to begin.'
                : !selectedSectionId
                ? 'Please select a section to view and record attendance.'
                : 'Loading...'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
