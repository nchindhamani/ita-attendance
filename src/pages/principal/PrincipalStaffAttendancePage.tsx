import { useEffect, useState, useRef, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useRequireActiveProfile } from '@/lib/auth-client'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { formatPacificDate } from '@/lib/time'
import { getCurrentSchoolYear } from '@/lib/school-year'
import { fetchWorkingDays, formatIsoAsMdY, pickDefaultWorkingDate } from '@/lib/working-days'
import type { AttendanceStatus } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { OtherStaffAttendanceEditor } from '@/features/attendance/OtherStaffAttendanceEditor'

const supabase = createSupabaseBrowserClient()

type StaffMember = {
  id: string
  full_name: string
  email: string | null
  role: string
  description: string | null
}

export default function PrincipalStaffAttendancePage() {
  const { profile, loading: authLoading } = useRequireActiveProfile()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const dateParam = searchParams.get('date')
  const [initialLoading, setInitialLoading] = useState(true)
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [existingAttendance, setExistingAttendance] = useState<Record<string, { status: AttendanceStatus; comments?: string | null }>>({})
  const [workingDays, setWorkingDays] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [schoolYear, setSchoolYear] = useState<string>(getCurrentSchoolYear())
  const [selectedDate, setSelectedDate] = useState<string>(dateParam || formatPacificDate(new Date()))
  const staffLoadedRef = useRef(false)
  const cachedStaffRef = useRef<StaffMember[]>([])
  const cachedSchoolYearRef = useRef<string>(getCurrentSchoolYear())
  const workingDaysInitializedRef = useRef(false)

  const today = formatPacificDate(new Date())

  const syncDateInUrl = useCallback(
    (date: string) => {
      if (!profile?.role) return
      const path =
        profile.role === 'admin' ? '/admin/staff-attendance' : '/principal/staff-attendance'
      const newSearchParams = new URLSearchParams(searchParams)
      newSearchParams.set('date', date)
      navigate(`${path}?${newSearchParams.toString()}`, { replace: true })
    },
    [searchParams, navigate, profile?.role]
  )

  // Fetch attendance data for a given date (reusable)
  const fetchAttendanceForDate = useCallback(async (date: string, _currentSchoolYear: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const response = await fetch(`/api/other-staff-attendance?date=${date}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        console.error('Error fetching staff attendance')
        setExistingAttendance({})
      } else {
        const data = await response.json()

        if (data.attendance && Array.isArray(data.attendance) && data.attendance.length > 0) {
          const existing = data.attendance.reduce(
            (acc: Record<string, { status: AttendanceStatus; comments?: string | null }>, entry: any) => {
              if (entry && entry.staff_id) {
                acc[entry.staff_id] = {
                  status: entry.status as AttendanceStatus,
                  comments: entry.comments ?? '',
                }
              }
              return acc
            },
            {} as Record<string, { status: AttendanceStatus; comments?: string | null }>
          )
          setExistingAttendance(existing)
        } else {
          setExistingAttendance({})
        }
      }
    } catch (err) {
      console.error('Error fetching attendance:', err)
    }
  }, [])

  // Load working days (must be before any conditional returns — Rules of Hooks)
  useEffect(() => {
    let cancelled = false
    const loadWorkingDays = async () => {
      const dates = await fetchWorkingDays(schoolYear, 'regular')
      if (cancelled) return
      setWorkingDays(dates)
      if (!workingDaysInitializedRef.current) {
        workingDaysInitializedRef.current = true
        const preferred = dateParam || pickDefaultWorkingDate(dates, today)
        if (preferred && preferred !== selectedDate) {
          setSelectedDate(preferred)
          syncDateInUrl(preferred)
        } else if (!dateParam && preferred) {
          syncDateInUrl(preferred)
        } else if (!dateParam) {
          syncDateInUrl(selectedDate)
        }
      } else if (dates.length && !dates.includes(selectedDate)) {
        const preferred = pickDefaultWorkingDate(dates, today)
        if (preferred) {
          setSelectedDate(preferred)
          syncDateInUrl(preferred)
        }
      }
    }
    void loadWorkingDays()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolYear])

  // Initial load: fetch staff once
  useEffect(() => {
    if (authLoading || !profile) return
    if (staffLoadedRef.current) return

    const fetchInitialData = async () => {
      setInitialLoading(true)
      setError(null)

      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          throw new Error('Not authenticated')
        }

        const currentSchoolYear = getCurrentSchoolYear()
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
          const errorData = await response.json().catch(() => ({ error: 'Failed to fetch staff' }))
          throw new Error(errorData.error || errorData.detail || 'Failed to fetch staff')
        }

        const data = await response.json()
        const allUsers = data.users || []

        const otherStaff = allUsers
          .filter((user: any) => {
            return (
              user.is_approved &&
              user.is_active &&
              user.role !== 'teacher' &&
              user.role !== 'principal'
            )
          })
          .map((user: any) => ({
            id: user.id,
            full_name: user.full_name || '',
            email: user.email,
            role: user.role || '',
            description: user.description || null,
          }))

        setStaffMembers(otherStaff)
        cachedStaffRef.current = otherStaff
        staffLoadedRef.current = true

        if (otherStaff.length > 0) {
          await fetchAttendanceForDate(selectedDate, currentSchoolYear)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setInitialLoading(false)
      }
    }

    void fetchInitialData()
    // Intentionally omit selectedDate — date changes are handled below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, authLoading, fetchAttendanceForDate])

  // When date changes after initial load, only re-fetch attendance
  useEffect(() => {
    if (!staffLoadedRef.current) return
    if (cachedStaffRef.current.length === 0) return

    void fetchAttendanceForDate(selectedDate, cachedSchoolYearRef.current)
  }, [selectedDate, fetchAttendanceForDate])

  const isFutureDate = selectedDate > today
  const isWorkingDay = workingDays.includes(selectedDate)
  const lockMessage =
    workingDays.length === 0
      ? `No working days uploaded for the Regular calendar (${schoolYear}). Upload them under Working Days first.`
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
    syncDateInUrl(newDate)
  }

  const refreshAttendance = async () => {
    if (staffMembers.length === 0) return
    await fetchAttendanceForDate(selectedDate, schoolYear)
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
        <CardHeader>
          <CardTitle>Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (staffMembers.length === 0) {
    return (
      <div className="space-y-3">
        <div>
          <h2 className="text-[2.5rem] font-heading font-bold text-[#0f172a] leading-tight">
            Record Volunteer/Staff Attendance
          </h2>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">
              No volunteers or staff found. Please ensure staff members are created and approved.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-[2.5rem] font-heading font-bold text-[#0f172a] leading-tight">
          Record Volunteer/Staff Attendance
        </h2>
      </div>
      <OtherStaffAttendanceEditor
        schoolYear={schoolYear}
        attendanceDate={selectedDate}
        staffMembers={staffMembers}
        existing={existingAttendance}
        locked={locked || isFutureDate}
        holidayName={null}
        lockMessage={lockMessage}
        allowedDates={workingDays}
        schoolYearDisplay={schoolYear}
        onAttendanceSaved={refreshAttendance}
        onDateChange={handleDateChange}
      />
    </div>
  )
}
