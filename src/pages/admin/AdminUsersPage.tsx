import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { UserManagementActions } from '@/features/admin/UserManagementActions'
import { EmptyState } from '@/components/ui/empty-state'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useRequireRole } from '@/lib/auth-client'
import { Role } from '@/lib/types'
import { CreateStaffPage } from './CreateStaffPage'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

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

export default function AdminUsersPage() {
  useRequireRole('admin')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'directory'
  
  const [approvalQueue, setApprovalQueue] = useState<User[]>([])
  const [staffDirectory, setStaffDirectory] = useState<User[]>([])
  const [filteredStaff, setFilteredStaff] = useState<User[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all')
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Get session for authentication
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          navigate('/auth/login')
          return
        }

        // Get current admin profile ID
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setCurrentAdminId(user.id)
        }

        // Fetch all users from backend API (bypasses RLS)
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

        // Filter into approval queue and staff directory
        const approval = allUsers.filter((user: User) => !user.is_approved)
        const staff = allUsers.filter((user: User) => user.is_approved)

        setApprovalQueue(approval)
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

    // Filter by role
    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === roleFilter)
    }

    // Filter by search query
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
    // Refresh data after user action
    window.location.reload()
  }

  const handleDeleteStaff = async (userId: string) => {
    if (deleting || userId === currentAdminId) return
    try {
      setDeleting(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error('Not authenticated. Please sign in again.')
        setDeleting(false)
        return
      }
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        toast.error(data.error || data.detail || 'Failed to delete staff.')
        setDeleting(false)
        return
      }
      setStaffDirectory(prev => prev.filter(u => u.id !== userId))
      setFilteredStaff(prev => prev.filter(u => u.id !== userId))
      setDeleteConfirmUser(null)
      toast.success(data.message || 'Staff deleted.')
    } catch (e: any) {
      toast.error(e.message || 'An unexpected error occurred.')
    } finally {
      setDeleting(false)
    }
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
          Review approvals, manage roles, and deactivate staff.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={activeTab === 'directory' ? 'default' : 'outline'}
          asChild
        >
          <Link to="/admin/users?tab=directory">Staff Directory</Link>
        </Button>
        <Button
          size="sm"
          variant={activeTab === 'create' ? 'default' : 'outline'}
          asChild
        >
          <Link to="/admin/users?tab=create">Create Staff</Link>
        </Button>
        <Button
          size="sm"
          variant={activeTab === 'approval' ? 'default' : 'outline'}
          asChild
        >
          <Link to="/admin/users?tab=approval">Approval Queue ({approvalQueue.length})</Link>
        </Button>
      </div>

      {activeTab === 'create' ? (
        <CreateStaffPage onStaffCreated={handleUserUpdated} />
      ) : activeTab === 'approval' ? (
        <Card>
          <CardHeader>
            <CardTitle>Approval Queue</CardTitle>
          </CardHeader>
          <CardContent>
            {approvalQueue.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approvalQueue.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <Link
                            to={`/admin/users/${user.id}`}
                            className="font-medium text-primary underline"
                          >
                            {user.full_name ?? 'Unknown'}
                          </Link>
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell className="capitalize">{getDisplayRole(user)}</TableCell>
                        <TableCell>{user.grade ?? '-'}</TableCell>
                        <TableCell>{user.section ?? '-'}</TableCell>
                        <TableCell>
                          <UserManagementActions
                            userId={user.id}
                            isApproved={user.is_approved}
                            isActive={user.is_active}
                            role={user.role as 'teacher' | 'admin'}
                            view="approval"
                            onUserUpdated={handleUserUpdated}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <EmptyState
                icon="check"
                title="All caught up!"
                description="No pending approvals at this time."
              />
            )}
          </CardContent>
        </Card>
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
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => navigate(`/admin/users/${user.id}`)}
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
                          {user.id === currentAdminId && (
                            <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-700">
                              YOU
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/admin/users/${user.id}`)
                        }}
                      >
                        View Profile
                      </Button>
                      {user.id !== currentAdminId && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteConfirmUser(user)
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
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

      <Dialog open={!!deleteConfirmUser} onOpenChange={(open) => !open && setDeleteConfirmUser(null)}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Delete Staff</DialogTitle>
            <DialogDescription>
              This will permanently remove this staff member and all their data, including all attendance records they created or are linked to. This action cannot be undone. If this staff member is a teacher and they are the only teacher for a grade and section, that grade and section (and its students) will also be deleted. Do you still wish to proceed?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteConfirmUser(null)} disabled={deleting}>
              No
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmUser && handleDeleteStaff(deleteConfirmUser.id)}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Yes, delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
