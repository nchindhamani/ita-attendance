import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useRequireActiveProfile } from '@/lib/auth-client'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StudentList } from '@/features/teacher/StudentList'

const supabase = createSupabaseBrowserClient()

interface Section {
  id: string
  grade: string | null
  section: string | null
  room_number: string | null
  school_year: string | null
}

interface Student {
  id: string
  student_identifier: number | null
  full_name: string
}

interface AssignmentWithStudents {
  id: string
  section: Section
  students: Student[]
}

export default function TeacherPage() {
  const { profile, loading: authLoading } = useRequireActiveProfile()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [assignments, setAssignments] = useState<AssignmentWithStudents[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading || !profile) return

    const fetchData = async () => {
      setLoading(true)
      setError(null)

      try {
        // Fetch teacher_sections assignments
        const { data: assignmentsData, error: assignmentsError } = await supabase
          .from('teacher_sections')
          .select('id,section:sections(id,grade,section,room_number,school_year)')
          .eq('teacher_id', profile.id)

        if (assignmentsError) {
          setError('Failed to load sections')
          setLoading(false)
          return
        }

        if (!assignmentsData || assignmentsData.length === 0) {
          setAssignments([])
          setLoading(false)
          return
        }

        // Fetch students for each section
        const assignmentsWithStudents = await Promise.all(
          assignmentsData.map(async (assignment) => {
            // Handle section data (can be object or array)
            const sectionData = Array.isArray(assignment.section)
              ? assignment.section[0]
              : assignment.section

            if (!sectionData || !('id' in sectionData)) {
              return null
            }

            const section: Section = {
              id: sectionData.id,
              grade: sectionData.grade ?? null,
              section: sectionData.section ?? null,
              room_number: sectionData.room_number ?? null,
              school_year: sectionData.school_year ?? null,
            }

            // Fetch students for this section
            const { data: studentsData, error: studentsError } = await supabase
              .from('students')
              .select('id,student_identifier,full_name')
              .eq('section_id', section.id)
              .order('student_identifier', { ascending: true })

            if (studentsError) {
              console.error('Error fetching students:', studentsError)
            }

            const students: Student[] = (studentsData ?? []).map((s) => ({
              id: s.id,
              student_identifier: s.student_identifier,
              full_name: s.full_name,
            }))

            return {
              id: assignment.id,
              section,
              students,
            }
          })
        )

        // Filter out null assignments
        const validAssignments = assignmentsWithStudents.filter(
          (a): a is AssignmentWithStudents => a !== null
        )

        setAssignments(validAssignments)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [profile, authLoading])

  // Refresh function for StudentList after update
  const refreshStudents = async (sectionId: string) => {
    try {
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('id,student_identifier,full_name')
        .eq('section_id', sectionId)
        .order('student_identifier', { ascending: true })

      if (studentsError) {
        console.error('Error refreshing students:', studentsError)
        return
      }

      const students: Student[] = (studentsData ?? []).map((s) => ({
        id: s.id,
        student_identifier: s.student_identifier,
        full_name: s.full_name,
      }))

      // Update the students for this section
      setAssignments((prev) =>
        prev.map((assignment) =>
          assignment.section.id === sectionId
            ? { ...assignment, students }
            : assignment
        )
      )
    } catch (err) {
      console.error('Error refreshing students:', err)
    }
  }

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

  return (
    <div className="space-y-12">
      <div className="space-y-3">
        <h2 className="text-[2.5rem] font-heading font-bold text-[#0f172a] leading-tight mb-3">
          My Classes
        </h2>
        <p className="text-base text-muted-foreground">
          Manage students and take attendance for each assigned section.
        </p>
      </div>

      <div className="space-y-12">
        {assignments.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No sections assigned yet. Please contact an admin.
            </CardContent>
          </Card>
        ) : (
          assignments.map((assignment) => {
            const section = assignment.section

            return (
              <div key={assignment.id} className="space-y-8">
                <Card>
                  <CardHeader>
                    <CardTitle>
                      Grade {section.grade} - {section.section}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <p>School year: {section.school_year ?? 'N/A'}</p>
                    {section.room_number ? <p>Room: {section.room_number}</p> : null}
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm">
                        <Link to={`/attendance?section=${section.id}`}>
                          Take attendance
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/history?section=${section.id}`}>
                          View history
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Students</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <StudentList
                      students={assignment.students}
                      sectionId={section.id}
                      onStudentUpdated={() => refreshStudents(section.id)}
                    />
                  </CardContent>
                </Card>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
