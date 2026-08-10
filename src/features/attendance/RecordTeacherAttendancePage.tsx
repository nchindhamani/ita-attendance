import { useEffect, useState, useMemo, useRef, useCallback, useTransition } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useRequireActiveProfile } from '@/lib/auth-client'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { formatPacificDate } from '@/lib/time'
import { getCurrentSchoolYear } from '@/lib/school-year'
import { fetchWorkingDays, formatIsoAsMdY, pickDefaultWorkingDate } from '@/lib/working-days'
import type { AttendanceStatus } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/ui/date-input'
import { AttendanceStatistics } from '@/features/attendance/AttendanceStatistics'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import Papa from 'papaparse'

const supabase = createSupabaseBrowserClient()

const ALL_GRADES = '__ALL__'

type Teacher = {
  id: string
  full_name: string
  email: string | null
  grade: string | null
  section: string | null
}

// type Holiday = {
//   holiday_date: string
//   name: string
// }

type AttendanceEntry = {
  teacherId: string
  status: string
  comments: string
}

const saveTeacherAttendance = async (params: {
  attendanceDate: string
  schoolYear: string
  entries: { teacherId: string; status: string; comments?: string | null }[]
}): Promise<{ success?: string; error?: string }> => {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return { error: 'Not authenticated. Please sign in again.' }

    const response = await fetch('/api/teacher-attendance', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        attendanceDate: params.attendanceDate,
        schoolYear: params.schoolYear,
        entries: params.entries,
      }),
    })

    const responseText = await response.text()
    if (!responseText || responseText.trim() === '') {
      return { error: `Server error: ${response.status} ${response.statusText}. Empty response.` }
    }

    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      return { error: `Server error: ${response.status}. ${responseText.substring(0, 200)}` }
    }

    let data
    try {
      data = JSON.parse(responseText)
    } catch {
      return { error: `Failed to parse server response: ${responseText.substring(0, 200)}` }
    }

    if (!response.ok) return { error: data.error || data.detail || 'Failed to save attendance' }
    return { success: data.success || 'Attendance saved.' }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'An unexpected error occurred' }
  }
}

export interface RecordTeacherAttendancePageProps {
  hscpOnly?: boolean
  basePath?: string
  gradeLabel?: string
  emptyMessage?: string
  subtitle?: string
  csvPrefix?: string
}

export function RecordTeacherAttendancePage({
  hscpOnly = true,
  basePath = '/hscp-officer/record-teacher-attendance',
  gradeLabel = 'HSCP Grade',
  emptyMessage = 'No HSCP teachers found. Please ensure HSCP teachers are created and approved.',
  subtitle = 'Record and edit attendance for HSCP teachers.',
  csvPrefix = 'hscp-teacher-attendance',
}: RecordTeacherAttendancePageProps) {
  const { profile, loading: authLoading } = useRequireActiveProfile()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const dateParam = searchParams.get('date')
  const gradeParam = searchParams.get('grade') || ALL_GRADES

  const [initialLoading, setInitialLoading] = useState(true)
  const [teachers, setTeachers] = useState<Teacher[]>([])
  // const [holiday, setHoliday] = useState<Holiday | null>(null)
  const [workingDays, setWorkingDays] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [schoolYear, setSchoolYear] = useState<string>(getCurrentSchoolYear())
  const [selectedDate, setSelectedDate] = useState<string>(dateParam || formatPacificDate(new Date()))
  const [selectedGrade, setSelectedGrade] = useState<string>(gradeParam === 'all' ? ALL_GRADES : gradeParam)

  const [entries, setEntries] = useState<AttendanceEntry[]>([])
  const [showCommentInputs, setShowCommentInputs] = useState<Record<string, boolean>>({})
  const [isPending, startTransition] = useTransition()

  const teachersLoadedRef = useRef(false)
  const cachedSchoolYearRef = useRef<string>(getCurrentSchoolYear())
  const prevDateRef = useRef(selectedDate)
  const workingDaysInitializedRef = useRef(false)

  const today = formatPacificDate(new Date())
  const isAllGrades = selectedGrade === ALL_GRADES
  const calendarType = hscpOnly ? 'hscp' : 'regular'

  const availableGrades = useMemo(() => {
    const grades = new Set<string>()
    teachers.forEach((t) => {
      if (t.grade) grades.add(t.grade)
    })
    return Array.from(grades).sort()
  }, [teachers])

  const teachersByGrade = useMemo(() => {
    const map: Record<string, Teacher[]> = {}
    teachers.forEach((t) => {
      const grade = t.grade || 'Unknown'
      if (!map[grade]) map[grade] = []
      map[grade].push(t)
    })
    return map
  }, [teachers])

  useEffect(() => {
    const params = new URLSearchParams()
    if (selectedGrade === ALL_GRADES) params.set('grade', 'all')
    else if (selectedGrade) params.set('grade', selectedGrade)
    if (selectedDate) params.set('date', selectedDate)
    navigate(`${basePath}?${params.toString()}`, { replace: true })
  }, [selectedGrade, selectedDate, navigate, basePath])

  useEffect(() => {
    setShowCommentInputs({})
  }, [selectedDate])

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

  const fetchAttendanceForDate = useCallback(
    async (date: string, currentSchoolYear: string) => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) return

        // Holiday check disabled — working days allowlist is enforced in UI + API
        // const { data: holidayData } = await supabase
        //   .from('holidays')
        //   .select('holiday_date,name')
        //   .eq('school_year', currentSchoolYear)
        //   .eq('holiday_date', date)
        //   .maybeSingle()
        // setHoliday(holidayData || null)

        const response = await fetch(`/api/teacher-attendance?date=${date}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) return

        const data = await response.json()
        const existingMap: Record<string, { status: AttendanceStatus; comments?: string | null }> = {}

        if (data.attendance && Array.isArray(data.attendance)) {
          data.attendance.forEach((entry: any) => {
            if (entry && entry.teacher_id) {
              existingMap[entry.teacher_id] = {
                status: entry.status as AttendanceStatus,
                comments: entry.comments ?? '',
              }
            }
          })
        }

        setEntries((prevEntries) => {
          if (date !== prevDateRef.current || prevEntries.length === 0) {
            return teachers.map((t) => ({
              teacherId: t.id,
              status: existingMap[t.id]?.status ?? '',
              comments: existingMap[t.id]?.comments ?? '',
            }))
          }
          return prevEntries.map((e) => {
            const existing = existingMap[e.teacherId]
            if (existing) {
              return { ...e, status: existing.status, comments: existing.comments ?? '' }
            }
            return e
          })
        })
        prevDateRef.current = date
      } catch (err) {
        console.error('Error fetching attendance:', err)
      }
    },
    [teachers]
  )

  useEffect(() => {
    if (authLoading || !profile) return
    if (teachersLoadedRef.current) return

    const fetchInitialData = async () => {
      setInitialLoading(true)
      setError(null)

      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) throw new Error('Not authenticated')

        const currentSchoolYear = getCurrentSchoolYear()
        setSchoolYear(currentSchoolYear)
        cachedSchoolYearRef.current = currentSchoolYear

        const qs = new URLSearchParams({
          schoolYear: currentSchoolYear,
          hscpOnly: hscpOnly ? 'true' : 'false',
        })
        const response = await fetch(`/api/teachers?${qs.toString()}`, {
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
        const yearTeachers = data.teachers || []

        const filteredTeachers = yearTeachers.map((user: any) => ({
          id: user.id,
          full_name: user.full_name || '',
          email: user.email,
          grade: user.grade || null,
          section: user.section || null,
        }))

        setTeachers(filteredTeachers)
        teachersLoadedRef.current = true
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setInitialLoading(false)
      }
    }

    fetchInitialData()
  }, [profile, authLoading, hscpOnly])

  useEffect(() => {
    if (!teachersLoadedRef.current || teachers.length === 0) return
    fetchAttendanceForDate(selectedDate, cachedSchoolYearRef.current)
  }, [selectedDate, teachers, fetchAttendanceForDate])

  const updateEntry = (teacherId: string, updates: { status?: AttendanceStatus; comments?: string }) => {
    setEntries((prev) => prev.map((e) => (e.teacherId === teacherId ? { ...e, ...updates } : e)))
  }

  const getStatsForTeachers = useCallback(
    (teacherIds: string[]) => {
      const counts = { present: 0, absent: 0, late: 0, left_early: 0 }
      teacherIds.forEach((tid) => {
        const entry = entries.find((e) => e.teacherId === tid)
        const status = entry?.status as keyof typeof counts
        if (status && status in counts) counts[status] += 1
      })
      return counts
    },
    [entries]
  )

  const handleDateChange = (newDate: string) => {
    if (workingDays.length && !workingDays.includes(newDate)) {
      toast.error('That date is not a working day. Choose a listed class day.')
      return
    }
    setSelectedDate(newDate)
  }

  const handleGradeChange = (grade: string) => {
    setSelectedGrade(grade)
  }

  const isWorkingDay = workingDays.includes(selectedDate)
  const isFutureDate = selectedDate > today
  const sortedWorkingDays = [...workingDays].sort()
  const pickerMax =
    sortedWorkingDays.length > 0
      ? sortedWorkingDays[sortedWorkingDays.length - 1] > today
        ? sortedWorkingDays[sortedWorkingDays.length - 1]
        : today
      : today
  const pickerMin = sortedWorkingDays.length > 0 ? sortedWorkingDays[0] : undefined
  const lockMessage =
    workingDays.length === 0
      ? `No working days uploaded for the ${calendarType === 'hscp' ? 'HSCP' : 'Regular'} calendar (${schoolYear}). Upload them under Working Days first.`
      : !isWorkingDay
        ? 'Selected date is not a working day. Choose a listed class day from your upload.'
        : isFutureDate
          ? `This is a future class day (next: ${formatIsoAsMdY(selectedDate)}). You can view it, but saving opens on/after that date.`
          : null
  const locked = Boolean(lockMessage)

  const handleSave = () => {
    if (locked || isFutureDate) {
      toast.error('Cannot save attendance for this date.')
      return
    }

    let visibleTeacherIds: string[]
    if (isAllGrades) {
      visibleTeacherIds = teachers.map((t) => t.id)
    } else {
      visibleTeacherIds = (teachersByGrade[selectedGrade] || []).map((t) => t.id)
    }

    const entriesToSave = entries.filter((e) => visibleTeacherIds.includes(e.teacherId) && e.status !== '')
    if (entriesToSave.length === 0) {
      toast.error('Please set attendance status for at least one teacher before saving.')
      return
    }

    startTransition(() => {
      saveTeacherAttendance({
        attendanceDate: selectedDate,
        schoolYear,
        entries: entriesToSave,
      }).then((result) => {
        if (result?.error) {
          toast.error(result.error)
        } else {
          toast.success(result?.success ?? 'Attendance saved.')
          setTimeout(() => {
            fetchAttendanceForDate(selectedDate, schoolYear)
          }, 500)
        }
      })
    })
  }

  const handleDownloadCSV = () => {
    const targetTeachers = isAllGrades ? teachers : teachersByGrade[selectedGrade] || []
    const csvRows = targetTeachers.map((teacher) => {
      const entry = entries.find((e) => e.teacherId === teacher.id)
      return {
        Grade: teacher.grade || '',
        Section: teacher.section || '',
        Name: teacher.full_name,
        Email: teacher.email || '',
        'Attendance Date': selectedDate,
        Status: entry?.status || 'Not Recorded',
        Comments: entry?.comments ?? '',
      }
    })

    if (csvRows.length === 0) {
      toast.error('No data to download.')
      return
    }

    const csv = Papa.unparse(csvRows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const gradeLabelVal = isAllGrades ? 'all-grades' : selectedGrade
    link.setAttribute('download', `${csvPrefix}-${gradeLabelVal}-${selectedDate}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('CSV downloaded successfully.')
  }

  const renderTeacherCard = (teacher: Teacher, isMobile: boolean) => {
    const entry = entries.find((e) => e.teacherId === teacher.id)
    const currentStatus = entry?.status ?? ''
    const showCommentInput = showCommentInputs[teacher.id] ?? false

    const statusButtons = [
      { status: 'present', label: 'Present', color: '#10b981' },
      { status: 'absent', label: 'Absent', color: '#ef4444' },
      { status: 'late', label: 'Late', color: '#f97316' },
      { status: 'left_early', label: 'Left Early', color: '#8b5cf6' },
    ]

    return (
      <div
        key={teacher.id}
        className="rounded-[12px] border border-[#e5e7eb] bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:translate-y-[-8px] hover:shadow-[0_20px_40px_rgba(0,0,0,0.12)] hover:border-[#6366f1]"
      >
        <div className={`flex ${isMobile ? 'flex-col' : 'items-center justify-between'}`}>
          <div className={`flex-1 ${isMobile ? 'mb-3' : ''}`}>
            <p className="font-semibold text-[#0f172a] text-base">{teacher.full_name}</p>
            <p className="text-xs text-[#64748b] mt-0.5">
              {teacher.grade && teacher.section ? `${teacher.grade} - ${teacher.section}` : teacher.email || ''}
            </p>
          </div>
          <div className={`flex items-center gap-2 ${isMobile ? 'flex-wrap' : ''}`}>
            {statusButtons.map((btn) => (
              <button
                key={btn.status}
                type="button"
                onClick={() => !locked && !isFutureDate && updateEntry(teacher.id, { status: btn.status as AttendanceStatus })}
                disabled={locked || isFutureDate}
                className={`px-3 py-1.5 rounded-[8px] flex items-center justify-center transition-all text-sm font-medium ${
                  currentStatus === btn.status
                    ? `bg-white border-2`
                    : 'bg-white border border-[#e5e7eb] text-[#9ca3af] hover:border-[#d1d5db]'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                style={
                  currentStatus === btn.status
                    ? { borderColor: btn.color, color: btn.color, borderWidth: '2px' }
                    : undefined
                }
              >
                {btn.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() =>
                setShowCommentInputs((prev) => ({ ...prev, [teacher.id]: !prev[teacher.id] }))
              }
              className={`px-3 py-1.5 rounded-[8px] flex items-center justify-center bg-white transition-all text-sm font-medium ${
                entry?.comments && entry.comments.trim()
                  ? 'border-2 border-[#3b82f6] text-[#3b82f6]'
                  : 'border border-[#e5e7eb] text-[#9ca3af] hover:border-[#d1d5db]'
              }`}
            >
              Comments
            </button>
          </div>
        </div>
        {(showCommentInput || (entry?.comments && entry.comments.trim())) && (
          <div className="mt-3">
            <Input
              value={entry?.comments ?? ''}
              onChange={(event) => updateEntry(teacher.id, { comments: event.target.value })}
              placeholder="Add a comment..."
              disabled={locked || isFutureDate}
              className="w-full"
            />
          </div>
        )}
      </div>
    )
  }

  const renderGradeCard = (grade: string) => {
    const gradeTeachers = teachersByGrade[grade] || []
    const gradeTeacherIds = gradeTeachers.map((t) => t.id)
    const gradeTeacherStats = getStatsForTeachers(gradeTeacherIds)

    return (
      <Card key={grade} className="border border-[#e5e7eb] shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl font-bold text-[#0f172a]">
            {grade}
            <span className="text-sm font-normal text-muted-foreground ml-2">
              ({gradeTeachers.length} teachers)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {gradeTeachers.length > 0 ? (
            <div className="space-y-4">
              <AttendanceStatistics counts={gradeTeacherStats} />
              <div className="space-y-3">
                <div className="hidden md:block space-y-3">
                  {gradeTeachers.map((t) => renderTeacherCard(t, false))}
                </div>
                <div className="md:hidden space-y-3">
                  {gradeTeachers.map((t) => renderTeacherCard(t, true))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">
              No teachers found for {grade}.
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

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

  if (teachers.length === 0 && !initialLoading) {
    return (
      <div className="space-y-3">
        <div>
          <h2 className="text-[2.5rem] font-heading font-bold text-[#0f172a] leading-tight">
            Record Teacher Attendance
          </h2>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">{emptyMessage}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const renderSingleGradeView = () => {
    const gradeTeachers = teachersByGrade[selectedGrade] || []
    const gradeTeacherIds = gradeTeachers.map((t) => t.id)
    const gradeTeacherStats = getStatsForTeachers(gradeTeacherIds)

    return (
      <Card className="border border-[#e5e7eb] shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl font-bold text-[#0f172a]">
            {selectedGrade}
            <span className="text-sm font-normal text-muted-foreground ml-2">
              ({gradeTeachers.length} teachers)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {gradeTeachers.length > 0 ? (
            <div className="space-y-4">
              <AttendanceStatistics counts={gradeTeacherStats} />
              <div className="space-y-3">
                <div className="hidden md:block space-y-3">
                  {gradeTeachers.map((t) => renderTeacherCard(t, false))}
                </div>
                <div className="md:hidden space-y-3">
                  {gradeTeachers.map((t) => renderTeacherCard(t, true))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">
              No teachers found for {selectedGrade}.
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  const noGradesMessage = hscpOnly ? 'No HSCP grades found.' : 'No grades found.'

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[2.5rem] font-heading font-bold text-[#0f172a] leading-tight">
          Record Teacher Attendance
        </h2>
        <p className="text-base text-muted-foreground mt-1">{subtitle}</p>
      </div>

      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">School year: {schoolYear}</p>
        {/* Holiday messaging disabled — working days are the source of truth */}
        {/* {holiday && (
          <p className="text-sm text-emerald-600">
            Holiday: {holiday.name}. Attendance is not required today.
          </p>
        )} */}
      </div>

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
              <option key={grade} value={grade}>{grade}</option>
            ))}
          </select>
        </CardContent>
      </Card>

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
              <Button onClick={handleSave} disabled={isPending || locked || isFutureDate} className="w-full sm:w-auto">
                {isPending ? 'Saving...' : 'Save Attendance'}
              </Button>
              <Button onClick={handleDownloadCSV} variant="outline" className="w-full sm:w-auto">
                <Download className="w-4 h-4 mr-2" />
                Download CSV
              </Button>
            </div>
          </div>
          {lockMessage && <p className="text-sm text-amber-700">{lockMessage}</p>}
        </CardContent>
      </Card>

      {isAllGrades && (
        <>
          {availableGrades.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground text-center">{noGradesMessage}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {availableGrades.map((grade) => renderGradeCard(grade))}
            </div>
          )}
        </>
      )}

      {!isAllGrades && selectedGrade && renderSingleGradeView()}
    </div>
  )
}
