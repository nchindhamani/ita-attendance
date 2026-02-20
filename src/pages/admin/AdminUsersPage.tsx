import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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

const supabase = createSupabaseBrowserClient()

type User = {
  id: string
  full_name: string | null
  email: string
  role: string
  grade: string | null
  section: string | null
  mobile: string | null
  is_active: boolean
  is_approved: boolean
  created_at: string
}

export default function AdminUsersPage() {
  useRequireRole('admin')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'approval'
  
  const [approvalQueue, setApprovalQueue] = useState<User[]>([])
  const [staffDirectory, setStaffDirectory] = useState<User[]>([])
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  const handleUserUpdated = () => {
    // Refresh data after user action
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
          User Management
        </h2>
        <p className="text-base text-muted-foreground">
          Review approvals, manage roles, and deactivate staff.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={activeTab === 'approval' ? 'default' : 'outline'}
          asChild
        >
          <Link to="/admin/users?tab=approval">Approval Queue</Link>
        </Button>
        <Button
          size="sm"
          variant={activeTab === 'directory' ? 'default' : 'outline'}
          asChild
        >
          <Link to="/admin/users?tab=directory">Staff Directory</Link>
        </Button>
      </div>

      {activeTab === 'approval' ? (
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
                        <TableCell className="capitalize">{user.role}</TableCell>
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
        <Card>
          <CardHeader>
            <CardTitle>Staff Directory</CardTitle>
          </CardHeader>
          <CardContent>
            {staffDirectory.length > 0 ? (
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
                    {staffDirectory.map((user) => (
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
                        <TableCell className="capitalize">{user.role}</TableCell>
                        <TableCell>{user.grade ?? '-'}</TableCell>
                        <TableCell>{user.section ?? '-'}</TableCell>
                        <TableCell className="text-right">
                          <UserManagementActions
                            userId={user.id}
                            isApproved={user.is_approved}
                            isActive={user.is_active}
                            role={user.role as 'teacher' | 'admin'}
                            view="directory"
                            isSelf={user.id === currentAdminId}
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
                icon="users"
                title="No staff yet"
                description="Approved staff will appear here."
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
