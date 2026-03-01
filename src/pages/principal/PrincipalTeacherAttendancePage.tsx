import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRequireRole } from '@/lib/auth-client'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const supabase = createSupabaseBrowserClient()

interface TeacherAttendance {
  id: string
  teacher_id: string
  attendance_date: string
  status: string
  comments: string | null
  teacher_name: string | null
  grade: string | null
  section: string | null
}

export default function PrincipalTeacherAttendancePage() {
  useRequireRole('principal')
  const navigate = useNavigate()
  
  const [loading, setLoading] = useState(true)
  const [attendance, setAttendance] = useState<TeacherAttendance[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch teacher attendance with teacher and section info
        const { data, error: fetchError } = await supabase
          .from('teacher_attendance')
          .select(`
            id,
            teacher_id,
            attendance_date,
            status,
            comments,
            profiles!inner(full_name),
            teacher_sections!inner(
              sections!inner(grade, section)
            )
          `)
          .order('attendance_date', { ascending: false })
          .limit(100)

        if (fetchError) {
          throw new Error(fetchError.message)
        }

        // Transform the data
        const transformed = (data || []).map((item: any) => {
          const profile = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles
          const teacherSection = Array.isArray(item.teacher_sections) 
            ? item.teacher_sections[0] 
            : item.teacher_sections
          const section = teacherSection?.sections
            ? (Array.isArray(teacherSection.sections) ? teacherSection.sections[0] : teacherSection.sections)
            : null

          return {
            id: item.id,
            teacher_id: item.teacher_id,
            attendance_date: item.attendance_date,
            status: item.status,
            comments: item.comments,
            teacher_name: profile?.full_name || 'Unknown',
            grade: section?.grade || null,
            section: section?.section || null,
          }
        })

        setAttendance(transformed)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load teacher attendance')
        console.error('Error fetching teacher attendance:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchAttendance()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (error) {
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
      <div className="space-y-3">
        <h2 className="text-[2.5rem] font-heading font-bold text-[#0f172a] leading-tight mb-3">
          Teacher Attendance
        </h2>
        <p className="text-base text-muted-foreground">
          View teacher attendance records (read-only).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Teacher Attendance ({attendance.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {attendance.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Date</th>
                    <th className="text-left p-2">Teacher</th>
                    <th className="text-left p-2">Section</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Comments</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.map((record) => (
                    <tr key={record.id} className="border-b">
                      <td className="p-2">
                        {new Date(record.attendance_date).toLocaleDateString()}
                      </td>
                      <td className="p-2">{record.teacher_name}</td>
                      <td className="p-2">
                        {record.grade && record.section ? `${record.grade}/${record.section}` : '-'}
                      </td>
                      <td className="p-2 capitalize">{record.status}</td>
                      <td className="p-2">{record.comments || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground">No teacher attendance records found.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}



