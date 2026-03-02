import { useEffect, useState, useRef, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useRequireActiveProfile } from '@/lib/auth-client'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { formatPacificDate } from '@/lib/time'
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

type Holiday = {
  holiday_date: string
  name: string
}

export default function PrincipalStaffAttendancePage() {
  const { profile, loading: authLoading } = useRequireActiveProfile()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const dateParam = searchParams.get('date')
  const [initialLoading, setInitialLoading] = useState(true)
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [existingAttendance, setExistingAttendance] = useState<Record<string, { status: AttendanceStatus; comments?: string | null }>>({})
  const [holiday, setHoliday] = useState<Holiday | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [schoolYear, setSchoolYear] = useState<string>('2025-2026')
  const [selectedDate, setSelectedDate] = useState<string>(dateParam || formatPacificDate(new Date()))
  const staffLoadedRef = useRef(false)
  const cachedStaffRef = useRef<StaffMember[]>([])
  const cachedSchoolYearRef = useRef<string>('2025-2026')

  // Update URL if date param is missing
  useEffect(() => {
    if (!dateParam) {
      const today = formatPacificDate(new Date())
      const newSearchParams = new URLSearchParams(searchParams)
      newSearchParams.set('date', today)
      const basePath = profile?.role === 'admin' ? '/admin/staff-attendance' : '/principal/staff-attendance'
      navigate(`${basePath}?${newSearchParams.toString()}`, { replace: true })
    }
  }, [dateParam, searchParams, navigate, profile])

  // Fetch attendance data for a given date (reusable)
  const fetchAttendanceForDate = useCallback(async (date: string, currentSchoolYear: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      // Check for holiday
      const { data: holidayData } = await supabase
        .from('holidays')
        .select('holiday_date,name')
        .eq('school_year', currentSchoolYear)
        .eq('holiday_date', date)
        .maybeSingle()

      setHoliday(holidayData || null)

      // Fetch existing attendance for selected date using API endpoint
      const response = await fetch(`/api/other-staff-attendance?date=${date}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
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

  // Initial load: fetch staff and school year (only once)
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

        // Get current school year from settings
        const { data: settings } = await supabase
          .from('system_settings')
          .select('current_school_year')
          .eq('id', 1)
          .maybeSingle()

        const currentSchoolYear = settings?.current_school_year || '2025-2026'
        setSchoolYear(currentSchoolYear)
        cachedSchoolYearRef.current = currentSchoolYear

        // Fetch all users from backend API
        const response = await fetch('/api/admin/users', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to fetch staff' }))
          throw new Error(errorData.error || errorData.detail || 'Failed to fetch staff')
        }

        const data = await response.json()
        const allUsers = data.users || []

        // Filter: non-teacher, non-principal, approved, active staff
        const otherStaff = allUsers
          .filter((user: any) => {
            return user.is_approved && 
                   user.is_active &&
                   user.role !== 'teacher' && 
                   user.role !== 'principal'
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

        // Fetch attendance for the initial date
        if (otherStaff.length > 0) {
          await fetchAttendanceForDate(selectedDate, currentSchoolYear)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setInitialLoading(false)
      }
    }

    fetchInitialData()
  }, [profile, authLoading, selectedDate, fetchAttendanceForDate])

  // When date changes after initial load, only re-fetch attendance (not staff)
  useEffect(() => {
    if (!staffLoadedRef.current) return
    if (cachedStaffRef.current.length === 0) return

    fetchAttendanceForDate(selectedDate, cachedSchoolYearRef.current)
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

  const locked = Boolean(holiday)
  
  const today = formatPacificDate(new Date())
  const isFutureDate = selectedDate > today

  const handleDateChange = (newDate: string) => {
    if (newDate > today) return
    setSelectedDate(newDate)
    const newSearchParams = new URLSearchParams(searchParams)
    newSearchParams.set('date', newDate)
    const basePath = profile?.role === 'admin' ? '/admin/staff-attendance' : '/principal/staff-attendance'
    navigate(`${basePath}?${newSearchParams.toString()}`, { replace: true })
  }

  const refreshAttendance = async () => {
    if (staffMembers.length === 0) return
    await fetchAttendanceForDate(selectedDate, schoolYear)
  }

  if (staffMembers.length === 0 && !initialLoading) {
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
        holidayName={holiday?.name ?? null}
        schoolYearDisplay={schoolYear}
        onAttendanceSaved={refreshAttendance}
        onDateChange={handleDateChange}
      />
    </div>
  )
}

