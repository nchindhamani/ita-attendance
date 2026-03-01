import { useEffect, useState, useTransition } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Papa from 'papaparse'
import { toast } from 'sonner'
import { useRequireActiveProfile } from '@/lib/auth-client'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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
  const [dialogOpen, setDialogOpen] = useState<Record<string, boolean>>({})
  const [studentIdentifier, setStudentIdentifier] = useState<Record<string, string>>({})
  const [studentName, setStudentName] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()
  const [csvPending, startCsvTransition] = useTransition()

  useEffect(() => {
    if (authLoading || !profile) return

    const fetchData = async () => {
      setLoading(true)
      setError(null)

      try {
        // Fetch teacher_sections assignments
        let assignmentsData: any[] | null = null
        let assignmentsError: any = null
        
        const result = await supabase
          .from('teacher_sections')
          .select('id,section:sections(id,grade,section,room_number,school_year)')
          .eq('teacher_id', profile.id)
        
        assignmentsData = result.data
        assignmentsError = result.error

        if (assignmentsError) {
          setError('Failed to load sections')
          setLoading(false)
          return
        }

        if (!assignmentsData || assignmentsData.length === 0) {
          // If no assignments but teacher has grade/section, try to auto-fix
          if (profile.grade && profile.section) {
            try {
              const { data: { session } } = await supabase.auth.getSession()
              if (session) {
                // Call backend to auto-assign teacher to section
                const fixResponse = await fetch('/api/teacher/auto-assign-section', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                  },
                })
                
                if (fixResponse.ok) {
                  // Retry fetching assignments after auto-assignment
                  const retryResult = await supabase
                    .from('teacher_sections')
                    .select('id,section:sections(id,grade,section,room_number,school_year)')
                    .eq('teacher_id', profile.id)
                  
                  if (!retryResult.error && retryResult.data && retryResult.data.length > 0) {
                    // Use the retry data
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
                .eq('school_year', section.school_year || '2025-2026')
              
              if (allSectionsData && allSectionsData.length > 0) {
                const sectionIds = allSectionsData.map(s => s.id)
                const result = await supabase
                  .from('students')
                  .select('id,student_identifier,full_name')
                  .in('section_id', sectionIds)
                  .eq('school_year', section.school_year || '2025-2026')
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

  // Refresh function for StudentList after update
  const refreshStudents = async (sectionId: string) => {
    try {
      // For HSCP grades, we need to get all sections of that grade
      const assignment = assignments.find(a => a.section.id === sectionId)
      if (!assignment) return

      const section = assignment.section
      const isHSCPGrade = section.grade && section.grade.toUpperCase().startsWith('HSCP')
      
      let studentsData: any[] | null = null
      
      if (isHSCPGrade) {
        // For HSCP grades: get all sections of this grade, then get all students from those sections
        const { data: allSectionsData } = await supabase
          .from('sections')
          .select('id')
          .eq('grade', section.grade)
          .eq('school_year', section.school_year || '2025-2026')
        
        if (allSectionsData && allSectionsData.length > 0) {
          const sectionIds = allSectionsData.map(s => s.id)
          const result = await supabase
            .from('students')
            .select('id,student_identifier,full_name')
            .in('section_id', sectionIds)
            .eq('school_year', section.school_year || '2025-2026')
            .order('student_identifier', { ascending: true })
          
          studentsData = result.data
        } else {
          studentsData = []
        }
      } else {
        // For regular grades: fetch students for this specific section
        const result = await supabase
          .from('students')
          .select('id,student_identifier,full_name')
          .eq('section_id', sectionId)
          .order('student_identifier', { ascending: true })
        
        studentsData = result.data
      }

      if (!studentsData) return

      const students: Student[] = studentsData.map((s) => ({
        id: s.id,
        student_identifier: s.student_identifier,
        full_name: s.full_name,
      }))

      // Update the students for this section (and all HSCP sections if applicable)
      setAssignments((prev) =>
        prev.map((assignment) => {
          if (isHSCPGrade && assignment.section.grade === section.grade) {
            // Update all sections of the same HSCP grade
            return { ...assignment, students }
          } else if (assignment.section.id === sectionId) {
            return { ...assignment, students }
          }
          return assignment
        })
      )
    } catch (err) {
      console.error('Error refreshing students:', err)
    }
  }

  // Add student functions
  const addStudent = async (params: {
    sectionId: string
    schoolYear: string
    studentIdentifier: string
    fullName: string
  }): Promise<{ success?: string; error?: string }> => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        return { error: 'Not authenticated. Please sign in again.' }
      }

      const response = await fetch('/api/students', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sectionId: params.sectionId,
          schoolYear: params.schoolYear,
          studentIdentifier: params.studentIdentifier,
          fullName: params.fullName,
        }),
      })

      const contentType = response.headers.get('content-type')
      const responseText = await response.text()

      if (!responseText || responseText.trim() === '') {
        return {
          error: `Server error: ${response.status} ${response.statusText}. Empty response from server.`
        }
      }

      if (!contentType || !contentType.includes('application/json')) {
        return {
          error: `Server error: ${response.status} ${response.statusText}. ${responseText.substring(0, 200)}`
        }
      }

      let data
      try {
        data = JSON.parse(responseText)
      } catch (parseError) {
        return {
          error: `Failed to parse server response: ${responseText.substring(0, 200)}`
        }
      }

      if (!response.ok) {
        return { error: data.error || data.detail || `Server error: ${response.status}` }
      }

      return data
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : 'Failed to add student'
      }
    }
  }

  const addStudentsFromCsv = async (params: {
    sectionId: string
    schoolYear: string
    students: { studentIdentifier: string; fullName: string }[]
  }): Promise<{ success?: string; error?: string }> => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        return { error: 'Not authenticated. Please sign in again.' }
      }

      const response = await fetch('/api/students/bulk', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sectionId: params.sectionId,
          schoolYear: params.schoolYear,
          students: params.students,
        }),
      })

      const contentType = response.headers.get('content-type')
      const responseText = await response.text()

      if (!responseText || responseText.trim() === '') {
        return {
          error: `Server error: ${response.status} ${response.statusText}. Empty response from server.`,
        }
      }

      if (!contentType || !contentType.includes('application/json')) {
        return {
          error: `Server error: ${response.status} ${response.statusText}. ${responseText.substring(0, 200)}`,
        }
      }

      let data
      try {
        data = JSON.parse(responseText)
      } catch (parseError) {
        return {
          error: `Failed to parse server response: ${responseText.substring(0, 200)}`,
        }
      }

      if (!response.ok) {
        return { error: data.detail || data.error || 'Failed to upload roster.' }
      }

      return { success: data.success || 'Student roster uploaded.' }
    } catch (e: any) {
      return { error: e.message || 'An unexpected error occurred.' }
    }
  }

  const handleManualAdd = (sectionId: string, schoolYear: string) => {
    const identifier = studentIdentifier[sectionId]?.trim() || ''
    const name = studentName[sectionId]?.trim() || ''
    
    if (!identifier || !name) {
      toast.error('Enter a student ID and name.')
      return
    }
    
    startTransition(() => {
      addStudent({
        sectionId,
        schoolYear,
        studentIdentifier: identifier,
        fullName: name,
      }).then(async (result) => {
        if (result?.error) {
          toast.error(result.error)
        } else {
          toast.success(result?.success ?? 'Student added.')
          setStudentIdentifier(prev => ({ ...prev, [sectionId]: '' }))
          setStudentName(prev => ({ ...prev, [sectionId]: '' }))
          setDialogOpen(prev => ({ ...prev, [sectionId]: false }))
          await refreshStudents(sectionId)
        }
      })
    })
  }

  const handleCsvUpload = (file: File, sectionId: string, schoolYear: string) => {
    startCsvTransition(() => {
      Papa.parse<string[]>(file, {
        skipEmptyLines: true,
        complete: async (results) => {
          const students = results.data
            .map((row, index) => {
              const id = String(row[0] ?? '').trim()
              const name = String(row[1] ?? '').trim()
              if (
                index === 0 &&
                id.toLowerCase().includes('id') &&
                name.toLowerCase().includes('name')
              ) {
                return null
              }
              return { studentIdentifier: id, fullName: name }
            })
            .filter((row): row is { studentIdentifier: string; fullName: string } =>
              Boolean(row && row.studentIdentifier && row.fullName)
            )
          
          const result = await addStudentsFromCsv({
            sectionId,
            schoolYear,
            students,
          })
          
          if (result?.error) {
            toast.error(result.error)
          } else {
            toast.success(result?.success ?? 'Roster uploaded.')
            await refreshStudents(sectionId)
          }
        },
        error: () => {
          toast.error('Unable to parse CSV.')
        },
      })
    })
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
          My Class
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
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <Dialog 
                        open={dialogOpen[section.id] || false} 
                        onOpenChange={(open) => setDialogOpen(prev => ({ ...prev, [section.id]: open }))}
                      >
                        <DialogTrigger asChild>
                          <Button type="button" variant="outline">
                            Add student
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add student</DialogTitle>
                            <DialogDescription>
                              Enter the student ID and student name.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <label className="text-sm font-medium">Student ID</label>
                              <Input
                                value={studentIdentifier[section.id] || ''}
                                onChange={(event) => setStudentIdentifier(prev => ({ ...prev, [section.id]: event.target.value }))}
                                placeholder="STU-001"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-sm font-medium">Student name</label>
                              <Input
                                value={studentName[section.id] || ''}
                                onChange={(event) => setStudentName(prev => ({ ...prev, [section.id]: event.target.value }))}
                                placeholder="Student Name"
                              />
                            </div>
                            <div className="flex justify-end">
                              <Button 
                                onClick={() => handleManualAdd(section.id, section.school_year || '2025-2026')} 
                                disabled={isPending}
                              >
                                {isPending ? 'Adding...' : 'Add student'}
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>

                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">
                          CSV columns: Student ID, Student Name
                        </p>
                        <Input
                          type="file"
                          accept=".csv"
                          disabled={csvPending}
                          onChange={(event) => {
                            const file = event.target.files?.[0]
                            if (file) {
                              handleCsvUpload(file, section.id, section.school_year || '2025-2026')
                            }
                          }}
                        />
                      </div>
                    </div>
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
