import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRequireRole } from '@/lib/auth-client'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const supabase = createSupabaseBrowserClient()

interface Student {
  id: string
  full_name: string
  student_identifier: number | null
  section_id: string | null
  school_year: string
  grade: string | null
  section: string | null
}

export default function AttendanceOfficerStudentsPage() {
  useRequireRole('attendance_officer')
  const navigate = useNavigate()
  
  const [students, setStudents] = useState<Student[]>([])
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch all students (read-only via RLS)
        const { data, error: fetchError } = await supabase
          .from('students')
          .select(`
            id,
            full_name,
            student_identifier,
            section_id,
            school_year,
            sections!left(grade, section)
          `)
          .order('full_name', { ascending: true })

        if (fetchError) {
          throw new Error(fetchError.message)
        }

        // Transform data
        const transformed = (data || []).map((item: any) => {
          const section = item.sections
            ? (Array.isArray(item.sections) ? item.sections[0] : item.sections)
            : null

          return {
            id: item.id,
            full_name: item.full_name,
            student_identifier: item.student_identifier,
            section_id: item.section_id,
            school_year: item.school_year,
            grade: section?.grade || null,
            section: section?.section || null,
          }
        })

        setStudents(transformed)
        setFilteredStudents(transformed)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load students')
        console.error('Error fetching students:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchStudents()
  }, [])

  // Filter students based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredStudents(students)
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = students.filter(
      (student) =>
        student.full_name?.toLowerCase().includes(query) ||
        student.student_identifier?.toString().includes(query) ||
        student.grade?.toLowerCase().includes(query) ||
        student.section?.toLowerCase().includes(query)
    )
    setFilteredStudents(filtered)
  }, [searchQuery, students])

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
          Student Profiles
        </h2>
        <p className="text-base text-muted-foreground">
          View student profiles (read-only).
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Input
          placeholder="Search by name, ID, grade, or section..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">🔍</span>
      </div>

      {/* Student Cards Grid */}
      {filteredStudents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStudents.map((student) => (
            <Card key={student.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">{student.full_name}</h3>
                  <p className="text-sm text-muted-foreground">
                    ID: {student.student_identifier || 'N/A'}
                  </p>
                  {student.grade && student.section && (
                    <p className="text-sm text-muted-foreground">
                      {student.grade}/{student.section}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    School Year: {student.school_year}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground text-center">
              {searchQuery ? 'No students found matching your search.' : 'No students found.'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}



