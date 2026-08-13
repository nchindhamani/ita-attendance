import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getCurrentSchoolYear } from '@/lib/school-year'
import { formatIsoAsMdY } from '@/lib/working-days'
import type { Role } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const supabase = createSupabaseBrowserClient()

type AttendanceRow = {
  id: string
  attendance_date: string
  status: string
  comments: string | null
}

const statusColors: Record<string, string> = {
  present: 'bg-[#d1fae5] text-[#065f46]',
  absent: 'bg-[#fee2e2] text-[#991b1b]',
  late: 'bg-[#fed7aa] text-[#9a3412]',
  left_early: 'bg-[#e9d5ff] text-[#6b21a8]',
}

interface StaffAttendanceHistoryProps {
  staffId: string
  /** When teacher, reads teacher_attendance; otherwise other_staff_attendance. */
  role: Role
}

/** Current academic-year attendance history for a staff member. */
export function TeacherAttendanceHistory({ staffId, role }: StaffAttendanceHistoryProps) {
  const schoolYear = getCurrentSchoolYear()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<AttendanceRow[]>([])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const isTeacher = role === 'teacher'
        const query = isTeacher
          ? supabase
              .from('teacher_attendance')
              .select('id,attendance_date,status,comments')
              .eq('teacher_id', staffId)
              .eq('school_year', schoolYear)
              .order('attendance_date', { ascending: false })
          : supabase
              .from('other_staff_attendance')
              .select('id,attendance_date,status,comments')
              .eq('staff_id', staffId)
              .eq('school_year', schoolYear)
              .order('attendance_date', { ascending: false })

        const { data, error: fetchError } = await query

        if (fetchError) {
          throw new Error(fetchError.message)
        }
        if (!cancelled) {
          setRows((data as AttendanceRow[]) ?? [])
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load attendance history')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [staffId, role, schoolYear])

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading attendance history...</p>
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Attendance History</CardTitle>
        <p className="text-sm text-muted-foreground">
          Current academic year ({schoolYear}), newest first.
        </p>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No attendance records found for {schoolYear}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Comments</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{formatIsoAsMdY(row.attendance_date)}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                          statusColors[row.status] || 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {row.status.replace('_', ' ')}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.comments?.trim() ? row.comments : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
