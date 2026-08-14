import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useRequireActiveProfile } from '@/lib/auth-client'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getCurrentSchoolYear } from '@/lib/school-year'
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
  const [loading, setLoading] = useState(true)
  const [assignments, setAssignments] = useState<AssignmentWithStudents[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading || !profile) return

    const fetchData = async () => {
      setLoading(true)
      setError(null)

      try {
        // Current school year only (same rule as admin teacher lists)
        const currentYear = getCurrentSchoolYear()
        const assignmentSelect =
          'id,section:sections!inner(id,grade,section,room_number,school_year)'

        let assignmentsData: any[] | null = null
        let assignmentsError: any = null

        const result = await supabase
          .from('teacher_sections')
          .select(assignmentSelect)
          .eq('teacher_id', profile.id)
          .eq('sections.school_year', currentYear)

        assignmentsData = result.data
        assignmentsError = result.error

        if (assignmentsError) {
          setError('Failed to load sections')
          setLoading(false)
          return
        }

        if (!assignmentsData || assignmentsData.length === 0) {
          // No current-year assignment — try auto-assign from profile grade/section
          if (profile.grade && profile.section) {
            try {
              const { data: { session } } = await supabase.auth.getSession()
              if (session) {
                const fixResponse = await fetch('/api/teacher/auto-assign-section', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                  },
                })

                if (fixResponse.ok) {
                  const retryResult = await supabase
                    .from('teacher_sections')
                    .select(assignmentSelect)
                    .eq('teacher_id', profile.id)
                    .eq('sections.school_year', currentYear)

                  if (!retryResult.error && retryResult.data && retryResult.data.length > 0) {
                    assignmentsData = retryResult.data
                  } else {
                    setAssignments([])
                    setLoading(false)
                    return
                  }
                } else {
                  setAssignments([])
                  setLoading(false)
                  return
                }
              } else {
                setAssignments([])
                setLoading(false)
                return
              }
            } catch (fixErr) {
              console.error('Error auto-assigning section:', fixErr)
              setAssignments([])
              setLoading(false)
              return
            }
          } else {
            setAssignments([])
            setLoading(false)
            return
          }
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

            // Check if this is an HSCP grade
            const isHSCPGrade = section.grade && section.grade.toUpperCase().startsWith('HSCP')
            
            let studentsData: any[] | null = null
            let studentsError: any = null
            
            if (isHSCPGrade) {
              // For HSCP grades: get all sections of this grade, then get all students from those sections
              const { data: allSectionsData } = await supabase
                .from('sections')
                .select('id')
                .eq('grade', section.grade)
                .eq('school_year', section.school_year || getCurrentSchoolYear())
              
              if (allSectionsData && allSectionsData.length > 0) {
                const sectionIds = allSectionsData.map(s => s.id)
                const result = await supabase
                  .from('students')
                  .select('id,student_identifier,full_name')
                  .in('section_id', sectionIds)
                  .eq('school_year', section.school_year || getCurrentSchoolYear())
                  .eq('is_active', true)
                  .order('student_identifier', { ascending: true })
                
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
                .select('id,student_identifier,full_name')
                .eq('section_id', section.id)
                .eq('is_active', true)
                .order('student_identifier', { ascending: true })
              
              studentsData = result.data
              studentsError = result.error
            }

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
          My Students
        </h2>
        <p className="text-base text-muted-foreground">
          View your class roster and take attendance for each assigned section.
        </p>
      </div>

      <div className="space-y-12">
        {assignments.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No class assigned for {getCurrentSchoolYear()}. Please contact an admin.
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
                          Mark Attendance
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/history?section=${section.id}`}>
                          Date Lookup
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
                    <StudentList students={assignment.students} />
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
