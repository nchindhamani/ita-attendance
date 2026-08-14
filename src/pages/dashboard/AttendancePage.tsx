import { useEffect, useState, useRef, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useRequireActiveProfile } from '@/lib/auth-client'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { formatPacificDate, isAfterDailyCutoff } from '@/lib/time'
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

// type Holiday = {
//   holiday_date: string
//   name: string
// }

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
  const dateParam = searchParams.get('date')
  console.log('Section ID:', sectionId, 'Profile:', profile)
  const [initialLoading, setInitialLoading] = useState(true)
  const [section, setSection] = useState<Section | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [existingAttendance, setExistingAttendance] = useState<Record<string, { status: AttendanceStatus; comments?: string | null }>>({})
  // const [holiday, setHoliday] = useState<Holiday | null>(null)
  const [workingDays, setWorkingDays] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>(dateParam || formatPacificDate(new Date()))
  const sectionLoadedRef = useRef(false)
  const cachedSectionRef = useRef<Section | null>(null)
  const cachedStudentIdsRef = useRef<string[]>([])
  const workingDaysInitializedRef = useRef(false)

  // Update URL if date param is missing
  useEffect(() => {
    if (!dateParam && sectionId) {
      const today = formatPacificDate(new Date())
      const newSearchParams = new URLSearchParams(searchParams)
      newSearchParams.set('date', today)
      navigate(`/attendance?${newSearchParams.toString()}`, { replace: true })
    }
  }, [dateParam, sectionId, searchParams, navigate])

  // Teachers: only current-year classroom assignment (same rule as admin lists)
  useEffect(() => {
    if (authLoading || !profile || profile.role !== 'teacher') return

    const resolveTeacherSection = async () => {
      const currentYear = getCurrentSchoolYear()
      const { data: assignments } = await supabase
        .from('teacher_sections')
        .select('section_id, section:sections!inner(school_year)')
        .eq('teacher_id', profile.id)
        .eq('sections.school_year', currentYear)
        .limit(1)

      const assignedSectionId = assignments?.[0]?.section_id ?? null

      if (!sectionId) {
        if (assignedSectionId) {
          navigate(`/attendance?section=${assignedSectionId}`, { replace: true })
        } else {
          setInitialLoading(false)
          setError(null)
        }
        return
      }

      // Stale prior-year section in the URL → bounce to current-year class
      const { data: sectionData } = await supabase
        .from('sections')
        .select('school_year')
        .eq('id', sectionId)
        .maybeSingle()

      if (sectionData?.school_year && sectionData.school_year !== currentYear) {
        if (assignedSectionId) {
          navigate(`/attendance?section=${assignedSectionId}`, { replace: true })
        } else {
          navigate('/attendance', { replace: true })
          setInitialLoading(false)
        }
      }
    }

    resolveTeacherSection()
  }, [profile, sectionId, navigate, authLoading])

  // Function to fetch students (extracted for reuse)
  const fetchStudents = async (sectionToFetch: Section) => {
    // Check if this is an HSCP grade
    const isHSCPGrade = sectionToFetch.grade && sectionToFetch.grade.toUpperCase().startsWith('HSCP')
    
    let studentsData: Student[] | null = null
    let studentsError: any = null
    
    if (isHSCPGrade) {
      // For HSCP grades: get all sections of this grade, then get all students from those sections
      const { data: allSectionsData } = await supabase
        .from('sections')
        .select('id')
        .eq('grade', sectionToFetch.grade)
        .eq('school_year', sectionToFetch.school_year || getCurrentSchoolYear())
      
      if (allSectionsData && allSectionsData.length > 0) {
        const sectionIds = allSectionsData.map(s => s.id)
        const result = await supabase
          .from('students')
          .select('id,full_name,student_identifier')
          .in('section_id', sectionIds)
          .eq('school_year', sectionToFetch.school_year || getCurrentSchoolYear())
          .eq('is_active', true)
          .order('full_name', { ascending: true })
        
        studentsData = result.data
        studentsError = result.error
      } else {
        // No sections found, return empty array
        studentsData = []
      }
    } else {
      // For regular grades: fetch students for this specific section
      const result = await supabase
        .from('students')
        .select('id,full_name,student_identifier')
        .eq('section_id', sectionToFetch.id)
        .eq('is_active', true)
        .order('full_name', { ascending: true })
      
      studentsData = result.data
      studentsError = result.error
    }

    if (studentsError) {
      console.error('Failed to load students:', studentsError)
      return null
    }

    return studentsData ?? []
  }

  // Load working days when section (grade calendar) is known
  useEffect(() => {
    if (!section?.school_year) return
    let cancelled = false
    const calendarType = calendarTypeForGrade(section.grade)
    const today = formatPacificDate(new Date())
    const loadWorkingDays = async () => {
      const dates = await fetchWorkingDays(section.school_year ?? getCurrentSchoolYear(), calendarType)
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
  }, [section?.id, section?.grade, section?.school_year])

  // Fetch attendance for a given date (reusable)
  const fetchAttendanceForDate = useCallback(async (date: string, sectionData: Section, studentIds: string[]) => {
    try {
      // Holiday check disabled — working days allowlist is enforced in UI + API
      // const { data: holidayData } = await supabase
      //   .from('holidays')
      //   .select('holiday_date,name')
      //   .eq('school_year', sectionData.school_year ?? '')
      //   .eq('holiday_date', date)
      //   .maybeSingle()
      // setHoliday(holidayData || null)

      // Fetch existing attendance for this specific section and selected date
      if (studentIds.length > 0) {
        const { data: attendanceData } = await supabase
          .from('student_attendance')
          .select('student_id,status,comments')
          .eq('attendance_date', date)
          .eq('section_id', sectionData.id)
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

  // Initial load: fetch section data and students (only once per sectionId)
  useEffect(() => {
    if (authLoading || !profile || !sectionId) {
      if (!sectionId && profile && profile.role !== 'teacher') {
        setInitialLoading(false)
      }
      return
    }

    // Reset if sectionId changed
    if (sectionLoadedRef.current && cachedSectionRef.current?.id === sectionId) {
      return
    }

    const fetchInitialData = async () => {
      setInitialLoading(true)
      setError(null)
      sectionLoadedRef.current = false

      try {
        // Fetch section data
        const { data: sectionData, error: sectionError } = await supabase
          .from('sections')
          .select('id,grade,section,room_number,school_year')
          .eq('id', sectionId)
          .maybeSingle()

        if (sectionError || !sectionData) {
          setError('Section not found')
          setInitialLoading(false)
          return
        }

        setSection(sectionData)
        cachedSectionRef.current = sectionData

        // Fetch students
        const studentsData = await fetchStudents(sectionData)
        if (studentsData === null) {
          setError('Failed to load students')
          setInitialLoading(false)
          return
        }

        setStudents(studentsData)
        const studentIds = studentsData.map(s => s.id)
        cachedStudentIdsRef.current = studentIds
        sectionLoadedRef.current = true

        // Fetch attendance for the initial date
        await fetchAttendanceForDate(selectedDate, sectionData, studentIds)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setInitialLoading(false)
      }
    }

    fetchInitialData()
  }, [sectionId, profile, authLoading, selectedDate, fetchAttendanceForDate])

  // When date changes after initial load, only re-fetch attendance (not section/students)
  useEffect(() => {
    if (!sectionLoadedRef.current) return
    if (!cachedSectionRef.current) return

    fetchAttendanceForDate(selectedDate, cachedSectionRef.current, cachedStudentIdsRef.current)
  }, [selectedDate, fetchAttendanceForDate])

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
          <CardTitle>
            {profile?.role === 'teacher' ? 'No class assigned' : 'Select a section'}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {profile?.role === 'teacher'
            ? `No class is assigned for ${getCurrentSchoolYear()}. Please contact an admin.`
            : 'Choose a section from your dashboard to take attendance.'}
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

  const today = formatPacificDate(new Date())
  const isFutureDate = selectedDate > today
  const calendarType = calendarTypeForGrade(section.grade)
  const isWorkingDay = workingDays.includes(selectedDate)
  const lockMessage =
    workingDays.length === 0
      ? `No working days uploaded for the ${calendarType === 'hscp' ? 'HSCP' : 'Regular'} calendar (${section.school_year}). Upload them under Working Days first.`
      : !isWorkingDay
        ? 'Selected day is not a working day. Choose a working day to save attendance.'
        : isFutureDate
          ? `This is a future class day (${formatIsoAsMdY(selectedDate)}). You can view it, but saving opens on/after that date.`
          : null
  const locked = Boolean(lockMessage)

  const handleDateChange = (newDate: string) => {
    if (workingDays.length && !workingDays.includes(newDate)) {
      toast.error('Selected day is not a working day. Choose a working day to save attendance.')
      return
    }
    setSelectedDate(newDate)
    // Update URL without navigation
    const newSearchParams = new URLSearchParams(searchParams)
    newSearchParams.set('date', newDate)
    navigate(`/attendance?${newSearchParams.toString()}`, { replace: true })
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-[2.5rem] font-heading font-bold text-[#0f172a] leading-tight">
          Mark Attendance - Grade {section.grade} {section.section}
        </h2>
      </div>
      <AttendanceEditor
        sectionId={sectionId}
        schoolYear={section.school_year ?? ''}
        attendanceDate={selectedDate}
        students={students}
        existing={existingAttendance}
        locked={locked || isFutureDate}
        holidayName={null}
        lockMessage={lockMessage}
        allowedDates={workingDays}
        schoolYearDisplay={section.school_year}
        onDateChange={handleDateChange}
        sectionGrade={section.grade}
        sectionName={section.section}
      />
    </div>
  )
}
