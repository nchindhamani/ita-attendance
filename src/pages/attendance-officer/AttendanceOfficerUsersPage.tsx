import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useRequireRole } from '@/lib/auth-client'
import { Role } from '@/lib/types'
import { CreateTeacherPage } from '@/features/admin/CreateTeacherPage'

const supabase = createSupabaseBrowserClient()

type Teacher = {
  id: string
  full_name: string | null
  email: string
  role: Role
  grade: string | null
  section: string | null
  school_year: string | null
  mobile: string | null
  is_active: boolean
  is_approved: boolean
  created_at: string
}

export default function AttendanceOfficerUsersPage() {
  useRequireRole('attendance_officer')
  const navigate = useNavigate()
  const [teachersDirectory, setTeachersDirectory] = useState<Teacher[]>([])
  const [filteredTeachers, setFilteredTeachers] = useState<Teacher[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchParams] = useSearchParams()
  const activeTab = (searchParams.get('tab') as 'directory' | 'create') || 'directory'

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)

        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          navigate('/auth/login')
          return
        }

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

        const teachers = allUsers.filter((user: Teacher) => user.role === 'teacher')

        setTeachersDirectory(teachers)
        setFilteredTeachers(teachers)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load teachers'
        setError(errorMessage)
        console.error('Error fetching teachers:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [navigate])

  useEffect(() => {
    let filtered = teachersDirectory

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(teacher =>
        teacher.full_name?.toLowerCase().includes(query) ||
        teacher.email?.toLowerCase().includes(query) ||
        teacher.grade?.toLowerCase().includes(query) ||
        teacher.section?.toLowerCase().includes(query)
      )
    }

    setFilteredTeachers(filtered)
  }, [teachersDirectory, searchQuery])

  const getInitials = (name: string | null) => {
    if (!name) return '??'
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const handleUserUpdated = () => {
    window.location.reload()
  }

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
    <div className="space-y-12">
      <div className="space-y-3">
        <h2 className="text-[2.5rem] font-heading font-bold text-[#0f172a] leading-tight mb-3">
          Teacher Management
        </h2>
        <p className="text-base text-muted-foreground">
          View and manage all teachers.
        </p>
      </div>

      <div className="flex gap-2 border-b">
        <Button
          variant={activeTab === 'directory' ? 'default' : 'outline'}
          asChild
        >
          <Link to="/attendance-officer/users?tab=directory">Teachers Directory ({teachersDirectory.length})</Link>
        </Button>
        <Button
          variant={activeTab === 'create' ? 'default' : 'outline'}
          asChild
        >
          <Link to="/attendance-officer/users?tab=create">Create Teacher</Link>
        </Button>
      </div>

      {activeTab === 'create' ? (
        <CreateTeacherPage
          onTeacherCreated={handleUserUpdated}
          hscpOnly={false}
          detailPath={(id) => `/attendance-officer/teachers/${id}`}
          directoryPath="/attendance-officer/users?tab=directory"
        />
      ) : (
        <div className="space-y-6">
          <div className="relative flex-1 max-w-md">
            <Input
              placeholder="Search by name, email, grade, or section..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">🔍</span>
          </div>

          {filteredTeachers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTeachers.map((teacher) => (
                <Card
                  key={teacher.id}
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => navigate(`/attendance-officer/teachers/${teacher.id}`)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-lg flex-shrink-0">
                        {getInitials(teacher.full_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg truncate">{teacher.full_name || 'Unknown'}</h3>
                        <p className="text-sm text-muted-foreground truncate">{teacher.email || 'No email'}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {teacher.grade && teacher.section && (
                            <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700">
                              {teacher.grade}/{teacher.section}
                            </span>
                          )}
                          {teacher.school_year && (
                            <span className="px-2 py-1 text-xs rounded-full bg-indigo-100 text-indigo-700">
                              {teacher.school_year}
                            </span>
                          )}
                          {!teacher.school_year && teacher.is_approved && (
                            <span className="px-2 py-1 text-xs rounded-full bg-amber-100 text-amber-800">
                              Not assigned this year
                            </span>
                          )}
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            teacher.is_active
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {teacher.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/attendance-officer/teachers/${teacher.id}`)
                        }}
                      >
                        View Profile
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="users"
              title="No teachers found"
              description={searchQuery
                ? "Try adjusting your search."
                : "No teachers are currently registered."}
            />
          )}
        </div>
      )}
    </div>
  )
}
