import { useEffect, useState, useRef, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useRequireRole } from '@/lib/auth-client'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { formatPacificDate } from '@/lib/time'
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

type Holiday = {
  holiday_date: string
  name: string
}

export default function HSCPOfficerRecordStudentAttendancePage() {
  useRequireRole('hscp_officer')
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
  const [holiday, setHoliday] = useState<Holiday | null>(null)
  const [schoolYear, setSchoolYear] = useState<string>('2025-2026')
  const [error, setError] = useState<string | null>(null)

  const studentsLoadedRef = useRef(false)
  const cachedStudentIdsRef = useRef<string[]>([])
  const cachedSectionIdRef = useRef<string>('')

  const today = formatPacificDate(new Date())

  // Fetch available HSCP grades and sections on mount
  useEffect(() => {
    const fetchGradesAndSections = async () => {
      setInitialLoading(true)
      try {
        // Get current school year
        const { data: settings } = await supabase
          .from('system_settings')
          .select('current_school_year')
          .eq('id', 1)
          .maybeSingle()

        const currentSchoolYear = settings?.current_school_year || '2025-2026'
        setSchoolYear(currentSchoolYear)

        // Fetch all HSCP sections
        const { data: sectionsData, error: sectionsError } = await supabase
          .from('sections')
          .select('id,grade,section,school_year')
          .like('grade', 'HSCP-%')
          .eq('school_year', currentSchoolYear)
          .order('grade', { ascending: true })
          .order('section', { ascending: true })

        if (sectionsError) {
          console.error('Error fetching HSCP sections:', sectionsError)
          setInitialLoading(false)
          return
        }

        const sections = sectionsData || []
        setAllSections(sections)

        // Extract unique grades
        const grades = [...new Set(sections.map(s => s.grade))].sort()
        setAvailableGrades(grades)

        // If we have a grade param, filter sections
        if (gradeParam && grades.includes(gradeParam)) {
          const filtered = sections.filter(s => s.grade === gradeParam)
          setFilteredSections(filtered)

          // If we have a section param too, load students
          if (sectionParam && filtered.some(s => s.id === sectionParam)) {
            await loadStudentsAndAttendance(sectionParam, currentSchoolYear, dateParam || formatPacificDate(new Date()))
          }
        } else if (grades.length > 0 && !gradeParam) {
          // Auto-select first grade
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
  }, [])

  // Load students for a section (HSCP: fetch all students from all sections of the same grade)
  const loadStudentsAndAttendance = async (sectionId: string, year: string, date: string) => {
    try {
      // Find the grade for the selected section
      const sectionData = allSections.find(s => s.id === sectionId)
      if (!sectionData) {
        setError('Section not found')
        return
      }

      // For HSCP grades: get all sections of this grade, then get all students from those sections
      const allGradeSections = allSections.filter(s => s.grade === sectionData.grade)
      const allGradeSectionIds = allGradeSections.map(s => s.id)

      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('id,full_name,student_identifier')
        .in('section_id', allGradeSectionIds)
        .eq('school_year', year)
        .order('full_name', { ascending: true })

      if (studentsError) {
        console.error('Error fetching students:', studentsError)
        setError('Failed to load students')
        return
      }

      const studentsList = studentsData || []
      setStudents(studentsList)
      const studentIds = studentsList.map(s => s.id)
      cachedStudentIdsRef.current = studentIds
      cachedSectionIdRef.current = sectionId
      studentsLoadedRef.current = true

      // Fetch attendance for the date
      await fetchAttendanceForDate(date, sectionId, studentIds, year)
    } catch (err) {
      console.error('Error loading students:', err)
    }
  }

  // Fetch attendance + holiday for a given date (reusable)
  const fetchAttendanceForDate = useCallback(async (date: string, sectionId: string, studentIds: string[], year: string) => {
    try {
      // Check for holiday
      const { data: holidayData } = await supabase
        .from('holidays')
        .select('holiday_date,name')
        .eq('school_year', year)
        .eq('holiday_date', date)
        .maybeSingle()

      setHoliday(holidayData || null)

      // Fetch existing attendance
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

  // When date changes after students are loaded, only re-fetch attendance
  useEffect(() => {
    if (!studentsLoadedRef.current) return
    if (!cachedSectionIdRef.current) return

    fetchAttendanceForDate(selectedDate, cachedSectionIdRef.current, cachedStudentIdsRef.current, schoolYear)
  }, [selectedDate, fetchAttendanceForDate, schoolYear])

  // Update URL params
  const updateUrl = (grade: string, section: string, date: string) => {
    const params = new URLSearchParams()
    if (grade) params.set('grade', grade)
    if (section) params.set('section', section)
    if (date) params.set('date', date)
    navigate(`/hscp-officer/record-student-attendance?${params.toString()}`, { replace: true })
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
    if (newDate > today) return
    setSelectedDate(newDate)
    updateUrl(selectedGrade, selectedSectionId, newDate)
  }

  // Get current section details for display
  const currentSection = allSections.find(s => s.id === selectedSectionId)
  const locked = Boolean(holiday)
  const isFutureDate = selectedDate > today

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

      {/* Grade & Section Selection */}
      <Card>
        <CardHeader className="px-4 pt-3 pb-0">
          <CardTitle className="text-lg mb-0 leading-none">Select Grade & Section</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pt-3 pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Grade Dropdown */}
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

            {/* Section Dropdown */}
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

      {/* Attendance Editor - Only show when grade and section are selected */}
      {selectedSectionId && currentSection ? (
        <AttendanceEditor
          sectionId={selectedSectionId}
          schoolYear={schoolYear}
          attendanceDate={selectedDate}
          students={students}
          existing={existingAttendance}
          locked={locked || isFutureDate}
          holidayName={holiday?.name ?? null}
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

