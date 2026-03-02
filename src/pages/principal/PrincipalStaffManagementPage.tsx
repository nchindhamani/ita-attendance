import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useRequireRole } from '@/lib/auth-client'
import { Role } from '@/lib/types'
import { CreateStaffPage } from '../admin/CreateStaffPage'

const supabase = createSupabaseBrowserClient()

type User = {
  id: string
  full_name: string | null
  email: string
  role: Role
  grade: string | null
  section: string | null
  description: string | null
  mobile: string | null
  is_active: boolean
  is_approved: boolean
  created_at: string
}

export default function PrincipalStaffManagementPage() {
  useRequireRole('principal')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'directory'
  
  const [staffDirectory, setStaffDirectory] = useState<User[]>([])
  const [filteredStaff, setFilteredStaff] = useState<User[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

        // Fetch all users from backend API
        const response = await fetch('/api/admin/users', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to fetch users' }))
          throw new Error(errorData.error || errorData.detail || 'Failed to fetch users')
        }

        const data = await response.json()
        const allUsers = data.users || []

        const staff = allUsers.filter((user: User) => user.is_approved)
        setStaffDirectory(staff)
        setFilteredStaff(staff)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load users'
        setError(errorMessage)
        console.error('Error fetching users:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [navigate])

  // Filter staff directory based on search and role
  useEffect(() => {
    let filtered = staffDirectory

    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === roleFilter)
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(user => 
        user.full_name?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query)
      )
    }

    setFilteredStaff(filtered)
  }, [staffDirectory, roleFilter, searchQuery])

  const getInitials = (name: string | null) => {
    if (!name) return '??'
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const roleCounts: Record<string, number> = {
    all: staffDirectory.length,
    admin: staffDirectory.filter(u => u.role === 'admin').length,
    teacher: staffDirectory.filter(u => u.role === 'teacher').length,
    principal: staffDirectory.filter(u => u.role === 'principal').length,
    attendance_officer: staffDirectory.filter(u => u.role === 'attendance_officer').length,
    hscp_officer: staffDirectory.filter(u => u.role === 'hscp_officer').length,
    volunteer: staffDirectory.filter(u => u.role === 'volunteer').length,
  }

  const formatRoleLabel = (role: Role | 'all') => {
    if (role === 'all') return 'All Staff'
    if (role === 'attendance_officer') return 'Officers'
    if (role === 'hscp_officer') return 'HSCP Officers'
    if (role === 'volunteer') return 'Volunteers'
    return role.charAt(0).toUpperCase() + role.slice(1) + 's'
  }

  const getDisplayRole = (user: User) => {
    if (user.role === 'volunteer' && user.description) {
      return `Volunteer - ${user.description}`
    }
    return user.role.replace('_', ' ')
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
          Staff Management
        </h2>
        <p className="text-base text-muted-foreground">
          View staff directory and create new staff members.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={activeTab === 'directory' ? 'default' : 'outline'}
          asChild
        >
          <Link to="/principal/staff-management?tab=directory">Staff Directory</Link>
        </Button>
        <Button
          size="sm"
          variant={activeTab === 'create' ? 'default' : 'outline'}
          asChild
        >
          <Link to="/principal/staff-management?tab=create">Create Staff</Link>
        </Button>
      </div>

      {activeTab === 'create' ? (
        <CreateStaffPage onStaffCreated={handleUserUpdated} basePath="/principal/staff-management" />
      ) : (
        <div className="space-y-6">
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">🔍</span>
            </div>
          </div>

          {/* Role Filter Pills */}
          <div className="flex flex-wrap gap-2">
            {(['all', 'admin', 'teacher', 'principal', 'attendance_officer', 'hscp_officer', 'volunteer'] as const).map((role) => (
              <Button
                key={role}
                variant={roleFilter === role ? 'default' : 'outline'}
                size="sm"
                onClick={() => setRoleFilter(role)}
              >
                {formatRoleLabel(role)} ({roleCounts[role] || 0})
              </Button>
            ))}
          </div>

          {/* Staff Cards Grid */}
          {filteredStaff.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredStaff.map((user) => (
                <Card 
                  key={user.id} 
                  className="hover:shadow-lg transition-shadow"
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-lg flex-shrink-0">
                        {getInitials(user.full_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg truncate">{user.full_name || 'Unknown'}</h3>
                        <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700 capitalize">
                            {getDisplayRole(user)}
                          </span>
                          {user.grade && user.section && (
                            <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700">
                              {user.grade}/{user.section}
                            </span>
                          )}
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            user.is_active 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {user.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="users"
              title="No staff found"
              description={searchQuery || roleFilter !== 'all' 
                ? "Try adjusting your search or filters."
                : "Approved staff will appear here."}
            />
          )}
        </div>
      )}
    </div>
  )
}

