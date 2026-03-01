import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useRequireActiveProfile } from '@/lib/auth-client'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { formatPacificDate } from '@/lib/time'
import type { AttendanceStatus } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TeacherAttendanceEditor } from '@/features/attendance/TeacherAttendanceEditor'

const supabase = createSupabaseBrowserClient()

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

export default function HSCPOfficerTeacherAttendancePage() {
  const { profile, loading: authLoading } = useRequireActiveProfile()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const dateParam = searchParams.get('date')
  const [loading, setLoading] = useState(true)
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [existingAttendance, setExistingAttendance] = useState<Record<string, { status: AttendanceStatus; comments?: string | null }>>({})
  const [holiday, setHoliday] = useState<Holiday | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [schoolYear, setSchoolYear] = useState<string>('2025-2026')
  const [selectedDate, setSelectedDate] = useState<string>(dateParam || formatPacificDate(new Date()))

  // Update URL if date param is missing
  useEffect(() => {
    if (!dateParam) {
      const today = formatPacificDate(new Date())
      const newSearchParams = new URLSearchParams(searchParams)
      newSearchParams.set('date', today)
      navigate(`/hscp-officer/teacher-attendance?${newSearchParams.toString()}`, { replace: true })
    }
  }, [dateParam, searchParams, navigate])

  // Fetch HSCP teachers
  useEffect(() => {
    if (authLoading || !profile) return

    const fetchData = async () => {
      setLoading(true)
      setError(null)

      try {
        // Get session for API call
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          throw new Error('Not authenticated')
        }

        // Get current school year from settings or default
        const { data: settings } = await supabase
          .from('system_settings')
          .select('current_school_year')
          .eq('id', 1)
          .maybeSingle()

        const currentSchoolYear = settings?.current_school_year || '2025-2026'
        setSchoolYear(currentSchoolYear)

        // Fetch HSCP teachers from backend API (same as other HSCP officer pages)
        const response = await fetch('/api/admin/users', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to fetch teachers' }))
          throw new Error(errorData.error || errorData.detail || 'Failed to fetch teachers')
        }

        const data = await response.json()
        const allUsers = data.users || []

        // Filter to only approved HSCP teachers (teachers with grade starting with 'HSCP')
        const hscpTeachers = allUsers
          .filter((user: any) => {
            const grade = user.grade?.toUpperCase() || ''
            return user.role === 'teacher' && user.is_approved && grade.startsWith('HSCP')
          })
          .map((user: any) => ({
            id: user.id,
            full_name: user.full_name || '',
            email: user.email,
            grade: user.grade || null,
            section: user.section || null,
          }))

        console.log('Fetched HSCP teachers:', hscpTeachers.length, hscpTeachers)
        setTeachers(hscpTeachers)

        // Check for holiday
        const { data: holidayData } = await supabase
          .from('holidays')
          .select('holiday_date,name')
          .eq('school_year', currentSchoolYear)
          .eq('holiday_date', selectedDate)
          .maybeSingle()

        if (holidayData) {
          setHoliday(holidayData)
        }

        // Fetch existing attendance for selected date using API endpoint
        if (hscpTeachers.length > 0) {
          console.log(`Fetching attendance for date ${selectedDate} via API`)
          
          const response = await fetch(`/api/teacher-attendance?date=${selectedDate}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Failed to fetch attendance' }))
            console.error('Error fetching teacher attendance:', errorData)
            setExistingAttendance({})
          } else {
            const data = await response.json()
            console.log(`Fetched attendance for ${selectedDate}:`, data)
            
            if (data.attendance && Array.isArray(data.attendance) && data.attendance.length > 0) {
              const existing = data.attendance.reduce(
                (acc: Record<string, { status: AttendanceStatus; comments?: string | null }>, entry: any) => {
                  if (entry && entry.teacher_id) {
                    acc[entry.teacher_id] = {
                      status: entry.status as AttendanceStatus,
                      comments: entry.comments ?? '',
                    }
                  }
                  return acc
                },
                {} as Record<string, { status: AttendanceStatus; comments?: string | null }>
              )
              console.log('Processed existing attendance:', existing)
              console.log('Setting existing attendance with', Object.keys(existing).length, 'entries')
              setExistingAttendance(existing)
            } else {
              console.log('No attendance data found for date:', selectedDate, '(empty array)')
              setExistingAttendance({})
            }
          }
        } else {
          setExistingAttendance({})
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [profile, selectedDate, authLoading])

  if (authLoading || loading) {
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

  const locked = Boolean(holiday) // Only lock on holidays
  
  // Check if selected date is in the future
  const today = formatPacificDate(new Date())
  const isFutureDate = selectedDate > today

  const handleDateChange = (newDate: string) => {
    // Don't allow future dates
    if (newDate > today) {
      return
    }
    setSelectedDate(newDate)
    // Update URL without navigation
    const newSearchParams = new URLSearchParams(searchParams)
    newSearchParams.set('date', newDate)
    navigate(`/hscp-officer/teacher-attendance?${newSearchParams.toString()}`, { replace: true })
  }

  // Refresh function to reload attendance after saving
  const refreshAttendance = async () => {
    if (teachers.length === 0) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        console.error('Not authenticated for refresh')
        return
      }

      console.log('Refreshing attendance for date:', selectedDate, 'via API')
      const response = await fetch(`/api/teacher-attendance?date=${selectedDate}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch attendance' }))
        console.error('Error refreshing teacher attendance:', errorData)
        return
      }

      const data = await response.json()
      console.log('Refreshed attendance data:', data)

      if (data.attendance && Array.isArray(data.attendance) && data.attendance.length > 0) {
        const existing = data.attendance.reduce(
          (acc: Record<string, { status: AttendanceStatus; comments?: string | null }>, entry: any) => {
            if (entry && entry.teacher_id) {
              acc[entry.teacher_id] = {
                status: entry.status as AttendanceStatus,
                comments: entry.comments ?? '',
              }
            }
            return acc
          },
          {} as Record<string, { status: AttendanceStatus; comments?: string | null }>
        )
        console.log('Updated existing attendance state:', existing)
        console.log('Setting existing attendance with', Object.keys(existing).length, 'entries')
        setExistingAttendance(existing)
      } else {
        console.log('No attendance data found when refreshing (empty array)')
        setExistingAttendance({})
      }
    } catch (err) {
      console.error('Error refreshing attendance:', err)
    }
  }

  if (teachers.length === 0 && !loading) {
    return (
      <div className="space-y-3">
        <div>
          <h2 className="text-[2.5rem] font-heading font-bold text-[#0f172a] leading-tight">
            HSCP Teacher Attendance
          </h2>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">
              No HSCP teachers found. Please ensure HSCP teachers are created and approved.
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
          HSCP Teacher Attendance
        </h2>
      </div>
      <TeacherAttendanceEditor
        schoolYear={schoolYear}
        attendanceDate={selectedDate}
        teachers={teachers}
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
