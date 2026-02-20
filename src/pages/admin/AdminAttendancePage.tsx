import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { HistoryTable } from '@/features/history/HistoryTable'
import { AttendanceStatistics } from '@/features/attendance/AttendanceStatistics'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { formatPacificDate } from '@/lib/time'
import { useRequireRole } from '@/lib/auth-client'

const supabase = createSupabaseBrowserClient()

type Section = {
  id: string
  grade: string
  section: string
}

type AttendanceEntry = {
  student_name: string
  student_identifier: number | null
  status: string
  comments: string | null
}

export default function AdminAttendancePage() {
  useRequireRole('admin')
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  
  const sectionIdParam = searchParams.get('section')
  const dateParam = searchParams.get('date')
  
  const [sections, setSections] = useState<Section[]>([])
  const [selectedSectionId, setSelectedSectionId] = useState<string>(sectionIdParam || '')
  const [selectedDate, setSelectedDate] = useState<string>(dateParam || formatPacificDate(new Date()))
  const [attendanceEntries, setAttendanceEntries] = useState<AttendanceEntry[]>([])
  const [statistics, setStatistics] = useState({
    present: 0,
    absent: 0,
    late: 0,
    left_early: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch sections on mount
  useEffect(() => {
    const fetchSections = async () => {
      try {
        setLoading(true)
        setError(null)

        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          navigate('/auth/login')
          return
        }

        const response = await fetch('/api/admin/sections', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to fetch sections' }))
          throw new Error(errorData.error || errorData.detail || 'Failed to fetch sections')
        }

        const data = await response.json()
        const sectionsList = data.sections || []
        setSections(sectionsList)

        // Set default section if none selected
        if (!selectedSectionId && sectionsList.length > 0) {
          setSelectedSectionId(sectionsList[0].id)
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load sections'
        setError(errorMessage)
        console.error('Error fetching sections:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchSections()
  }, [navigate, selectedSectionId])

  // Fetch attendance when section or date changes
  useEffect(() => {
    if (!selectedSectionId) {
      setAttendanceEntries([])
      setStatistics({ present: 0, absent: 0, late: 0, left_early: 0 })
      return
    }

    const fetchAttendance = async () => {
      try {
        setLoading(true)
        setError(null)

        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          navigate('/auth/login')
          return
        }

        const response = await fetch(
          `/api/admin/attendance?section_id=${encodeURIComponent(selectedSectionId)}&date=${encodeURIComponent(selectedDate)}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
          }
        )

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to fetch attendance' }))
          throw new Error(errorData.error || errorData.detail || 'Failed to fetch attendance')
        }

        const data = await response.json()
        setAttendanceEntries(data.entries || [])
        setStatistics(data.statistics || { present: 0, absent: 0, late: 0, left_early: 0 })
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load attendance'
        setError(errorMessage)
        console.error('Error fetching attendance:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchAttendance()
  }, [selectedSectionId, selectedDate, navigate])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const section = formData.get('section') as string
    const date = formData.get('date') as string
    
    setSelectedSectionId(section)
    setSelectedDate(date)
    
    // Update URL params
    const newParams = new URLSearchParams()
    if (section) newParams.set('section', section)
    if (date) newParams.set('date', date)
    navigate(`/admin/attendance?${newParams.toString()}`, { replace: true })
  }

  const selectedSection = sections.find((s) => s.id === selectedSectionId)
  const filename = `attendance-${selectedSection?.grade ?? ''}-${selectedSection?.section ?? ''}-${selectedDate}.csv`

  if (loading && sections.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (error && sections.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <p className="text-destructive">{error}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Attendance Reports</h2>
        <p className="text-sm text-muted-foreground">
          View attendance by class and export CSVs.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-3">
            <select
              name="section"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
            >
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  Grade {section.grade} - {section.section}
                </option>
              ))}
            </select>
            <Input
              type="date"
              name="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={formatPacificDate(new Date())}
              className="h-10"
            />
            <Button type="submit">View</Button>
          </form>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      {attendanceEntries.length > 0 && (
        <AttendanceStatistics counts={statistics} />
      )}

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <p className="text-muted-foreground">Loading attendance...</p>
        </div>
      ) : error ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-destructive">{error}</p>
            <Button onClick={() => window.location.reload()} className="mt-4">
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <HistoryTable
          rows={attendanceEntries}
          filename={filename}
        />
      )}
    </div>
  )
}
