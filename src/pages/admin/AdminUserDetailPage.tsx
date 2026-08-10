import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useRequireRole } from '@/lib/auth-client'
import { getCurrentSchoolYear } from '@/lib/school-year'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UserManagementActions } from '@/features/admin/UserManagementActions'
import { Role, ROLE_PERMISSIONS, ROLE_DESCRIPTIONS, ROLE_ICONS } from '@/lib/types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { Star, Shield, Edit, Save, X, Key, Trash2 } from 'lucide-react'
import { TemporaryPasswordDialog } from '@/components/admin/TemporaryPasswordDialog'
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
  room_number: string | null
  is_active: boolean
  is_approved: boolean
  requires_password_reset: boolean | null
  created_at: string
}

export default function AdminUserDetailPage() {
  useRequireRole('admin')
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'details' | 'roles'>('details')
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null)
  const [updatingRole, setUpdatingRole] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editFormData, setEditFormData] = useState({
    full_name: '',
    email: '',
    mobile: '',
    grade: '',
    section: '',
    room_number: '',
  })
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [passwordData, setPasswordData] = useState<{
    fullName: string
    role: string
    password: string
  } | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [teacherStudents, setTeacherStudents] = useState<{ id: string; student_identifier: number | null; full_name: string }[]>([])

  useEffect(() => {
    const fetchData = async () => {
      if (!id) {
        setError('User ID is required')
        setLoading(false)
        return
      }

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
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (authUser) {
          setCurrentAdminId(authUser.id)
        }

        // Fetch user from backend API
        const response = await fetch(`/api/admin/users`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to fetch user' }))
          throw new Error(errorData.error || errorData.detail || 'Failed to fetch user')
        }

        const data = await response.json()
        const allUsers = data.users || []
        const foundUser = allUsers.find((u: User) => u.id === id)

        if (!foundUser) {
          setError('User not found')
          setLoading(false)
          return
        }

        setUser(foundUser)
        // Initialize edit form data
        setEditFormData({
          full_name: foundUser.full_name || '',
          email: foundUser.email || '',
          mobile: foundUser.mobile || '',
          grade: foundUser.grade || '',
          section: foundUser.section || '',
          room_number: foundUser.room_number || '',
        })
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load user'
        setError(errorMessage)
        console.error('Error fetching user:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [id, navigate])

  // Fetch students for teachers
  useEffect(() => {
    if (!user || user.role !== 'teacher') {
      setTeacherStudents([])
      return
    }
    const fetchTeacherStudents = async () => {
      try {
        const { data: settings } = await supabase
          .from('system_settings')
          .select('current_school_year')
          .eq('id', 1)
          .maybeSingle()
        const schoolYear = getCurrentSchoolYear()

        const { data: assignments } = await supabase
          .from('teacher_sections')
          .select('section_id')
          .eq('teacher_id', user.id)

        if (!assignments || assignments.length === 0) {
          setTeacherStudents([])
          return
        }

        const sectionIds = [...new Set(assignments.map((a) => a.section_id))]
        const allStudents: { id: string; student_identifier: number | null; full_name: string }[] = []
        const seen = new Set<string>()

        for (const sectionId of sectionIds) {
          const { data: students } = await supabase
            .from('students')
            .select('id,student_identifier,full_name')
            .eq('section_id', sectionId)
            .eq('school_year', schoolYear)
          for (const s of students || []) {
            if (!seen.has(s.id)) {
              seen.add(s.id)
              allStudents.push({
                id: s.id,
                student_identifier: s.student_identifier,
                full_name: s.full_name || '',
              })
            }
          }
        }
        allStudents.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))
        setTeacherStudents(allStudents)
      } catch {
        setTeacherStudents([])
      }
    }
    fetchTeacherStudents()
  }, [user?.id, user?.role])

  const handleUserUpdated = () => {
    // Refresh data after user action
    window.location.reload()
  }

  const handleDeleteStaff = async () => {
    if (!id || deleting) return
    try {
      setDeleting(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error('Not authenticated. Please sign in again.')
        setDeleting(false)
        return
      }
      const response = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        toast.error(data.error || data.detail || 'Failed to delete staff.')
        setDeleting(false)
        return
      }
      setDeleteConfirmOpen(false)
      toast.success(data.message || 'Staff deleted.')
      navigate('/admin/users?tab=directory')
    } catch (e: any) {
      toast.error(e.message || 'An unexpected error occurred.')
    } finally {
      setDeleting(false)
    }
  }

  const handleShowTemporaryPassword = async () => {
    if (!user || !id) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error('Not authenticated. Please sign in again.')
        return
      }

      // Call API to generate/get temporary password
      const response = await fetch(`/api/admin/users/${id}/temporary-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || data.detail || 'Failed to get temporary password.')
        return
      }

      // Show password dialog
      if (data.temporary_password) {
        setPasswordData({
          fullName: data.full_name || user.full_name || '',
          role: data.role || user.role,
          password: data.temporary_password,
        })
        setShowPasswordDialog(true)
      } else {
        toast.error('No temporary password available.')
      }
    } catch (e: any) {
      toast.error(e.message || 'An unexpected error occurred.')
    }
  }

  const handleEdit = () => {
    if (!user) return
    setIsEditing(true)
    setEditFormData({
      full_name: user.full_name || '',
      email: user.email || '',
      mobile: user.mobile || '',
      grade: user.grade || '',
      section: user.section || '',
      room_number: user.room_number || '',
    })
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    if (user) {
      setEditFormData({
        full_name: user.full_name || '',
        email: user.email || '',
        mobile: user.mobile || '',
        grade: user.grade || '',
        section: user.section || '',
        room_number: user.room_number || '',
      })
    }
  }

  const handleSaveEdit = async () => {
    if (!user || !id || isSaving) return

    try {
      setIsSaving(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error('Not authenticated. Please sign in again.')
        setIsSaving(false)
        return
      }

      const payload: any = {}
      if (editFormData.full_name !== (user.full_name || '')) {
        payload.full_name = editFormData.full_name.trim()
      }
      if (editFormData.email !== (user.email || '')) {
        payload.email = editFormData.email.trim() || null
      }
      if (editFormData.mobile !== (user.mobile || '')) {
        payload.mobile = editFormData.mobile.trim() || null
      }
      if (editFormData.grade !== (user.grade || '')) {
        payload.grade = editFormData.grade.trim() || null
      }
      if (editFormData.section !== (user.section || '')) {
        payload.section = editFormData.section.trim() || null
      }
      if (editFormData.room_number !== (user.room_number || '')) {
        payload.room_number = editFormData.room_number.trim() || null
      }

      if (Object.keys(payload).length === 0) {
        setIsEditing(false)
        setIsSaving(false)
        return
      }

      const response = await fetch(`/api/admin/users/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || data.detail || 'Failed to update profile.')
        setIsSaving(false)
        return
      }

      // Show password dialog if temporary password is provided (email updated from placeholder)
      if (data.temporary_password && user) {
        setPasswordData({
          fullName: data.full_name || user.full_name || '',
          role: data.role || user.role,
          password: data.temporary_password,
        })
        setShowPasswordDialog(true)
        // Don't reload yet - wait for dialog to close
      } else {
        // No password dialog needed (email updated from valid to valid), just show success toast with longer duration
        toast.success('Profile updated successfully!', {
          duration: 2000, // 2 seconds
        })
        setIsEditing(false)
        // Delay reload slightly to ensure toast is visible
        setTimeout(() => {
          window.location.reload()
        }, 100)
      }
    } catch (e: any) {
      toast.error(e.message || 'An unexpected error occurred.')
      setIsSaving(false)
    }
  }

  const handleRoleUpdate = async (newRole: Role) => {
    if (!user || !id || updatingRole) return

    // Don't update if it's the same role
    if (user.role === newRole) {
      return
    }

    try {
      setUpdatingRole(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error('Not authenticated. Please sign in again.')
        setUpdatingRole(false)
        return
      }

      const response = await fetch('/api/admin/users/update-role', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profileId: id,
          role: newRole,
        }),
      })

      const contentType = response.headers.get('content-type')
      const responseText = await response.text()

      if (!responseText || responseText.trim() === '') {
        toast.error(`Server error: ${response.status} ${response.statusText}`)
        setUpdatingRole(false)
        return
      }

      if (!contentType || !contentType.includes('application/json')) {
        toast.error(`Server error: ${response.status} ${response.statusText}`)
        setUpdatingRole(false)
        return
      }

      const data = JSON.parse(responseText)

      if (!response.ok) {
        toast.error(data.detail || data.error || 'Failed to update role.')
        setUpdatingRole(false)
        return
      }

      toast.success(`Role updated to ${newRole.replace('_', ' ')}.`)
      // Update local state immediately for better UX
      setUser({ ...user, role: newRole })
      setUpdatingRole(false)
    } catch (e: any) {
      toast.error(e.message || 'An unexpected error occurred.')
      setUpdatingRole(false)
    }
  }

  const getInitials = (name: string | null) => {
    if (!name) return '??'
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <p className="text-destructive">{error || 'User not found'}</p>
          <Button onClick={() => navigate('/admin/users?tab=directory')}>Back to Staff Directory</Button>
        </div>
      </div>
    )
  }

  const isSelf = user.id === currentAdminId

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button
            variant="ghost"
            onClick={() => navigate('/admin/users?tab=directory')}
            className="mb-4"
          >
            ← Back to Staff Directory
          </Button>
          <h2 className="text-[2.5rem] font-heading font-bold text-[#0f172a] leading-tight">
            {user.full_name || 'Unknown'}
          </h2>
        </div>
      </div>

      {/* User Card Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-20 h-20 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-2xl flex-shrink-0">
              {getInitials(user.full_name)}
            </div>
            <div className="flex-1">
              {isEditing ? (
                <div className="space-y-2 mb-3">
                  <Label>Full Name</Label>
                  <Input
                    value={editFormData.full_name}
                    onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })}
                    className="text-2xl font-semibold"
                  />
                </div>
              ) : (
                <h3 className="font-semibold text-2xl mb-1">{user.full_name || 'Unknown'}</h3>
              )}
              <p className="text-muted-foreground mb-3">{user.email}</p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 text-sm rounded-full bg-blue-100 text-blue-700 capitalize">
                  {user.role === 'volunteer' && user.description
                    ? `Volunteer - ${user.description}`
                    : user.role.replace('_', ' ')}
                </span>
                {user.grade && user.section && (
                  <span className="px-3 py-1 text-sm rounded-full bg-gray-100 text-gray-700">
                    {user.grade}/{user.section}
                  </span>
                )}
                <span className={`px-3 py-1 text-sm rounded-full ${
                  user.is_active 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-red-100 text-red-700'
                }`}>
                  {user.is_active ? 'Active' : 'Inactive'}
                </span>
                {!user.is_approved && (
                  <span className="px-3 py-1 text-sm rounded-full bg-yellow-100 text-yellow-700">
                    Pending Approval
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <Button
          variant={activeTab === 'details' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('details')}
          className="rounded-b-none flex items-center gap-2"
        >
          <Star className="w-4 h-4" />
          Details
        </Button>
        <Button
          variant={activeTab === 'roles' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('roles')}
          className="rounded-b-none flex items-center gap-2"
        >
          <Shield className="w-4 h-4" />
          Roles & Permissions
        </Button>
      </div>

      {/* Details Tab */}
      {activeTab === 'details' && (
        <div className="space-y-6">
          {/* Edit Button */}
          <div className="flex justify-end gap-2">
            {!isEditing ? (
              <>
                {user.requires_password_reset && user.email && (
                  <Button 
                    onClick={handleShowTemporaryPassword} 
                    variant="outline" 
                    className="flex items-center gap-2"
                  >
                    <Key className="w-4 h-4" />
                    Generate new OTP
                  </Button>
                )}
                <Button onClick={handleEdit} variant="outline" className="flex items-center gap-2">
                  <Edit className="w-4 h-4" />
                  Edit Profile
                </Button>
              </>
            ) : (
              <div className="flex gap-2">
                <Button onClick={handleCancelEdit} variant="outline" className="flex items-center gap-2">
                  <X className="w-4 h-4" />
                  Cancel
                </Button>
                <Button onClick={handleSaveEdit} disabled={isSaving} className="flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            )}
          </div>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Email</Label>
                {isEditing ? (
                  <Input
                    type="email"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    className="mt-1"
                  />
                ) : (
                  <p className="text-base">{user.email}</p>
                )}
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Mobile</Label>
                {isEditing ? (
                  <Input
                    value={editFormData.mobile}
                    onChange={(e) => setEditFormData({ ...editFormData, mobile: e.target.value })}
                    className="mt-1"
                    placeholder="Enter mobile number"
                  />
                ) : (
                  <p className="text-base">{user.mobile || '-'}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Account Details */}
          <Card>
            <CardHeader>
              <CardTitle>Account Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Role</label>
                <p className="text-base capitalize">
                  {user.role === 'volunteer' && user.description
                    ? `Volunteer - ${user.description}`
                    : user.role.replace('_', ' ')}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Approval Status</label>
                <p className="text-base">{user.is_approved ? 'Approved' : 'Pending Approval'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Account Status</label>
                <p className="text-base">{user.is_active ? 'Active' : 'Inactive'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Teaching Assignment (only for teachers) */}
          {user.role === 'teacher' && (user.grade || user.section || user.room_number || isEditing) && (
            <Card>
              <CardHeader>
                <CardTitle>Teaching Assignment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isEditing ? (
                  <>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Grade</Label>
                      <Input
                        value={editFormData.grade}
                        onChange={(e) => setEditFormData({ ...editFormData, grade: e.target.value })}
                        className="mt-1"
                        placeholder="e.g., 1, 2, HSCP-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Section</Label>
                      <Input
                        value={editFormData.section}
                        onChange={(e) => setEditFormData({ ...editFormData, section: e.target.value })}
                        className="mt-1"
                        placeholder="e.g., A, B, 1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Room Number</Label>
                      <Input
                        value={editFormData.room_number}
                        onChange={(e) => setEditFormData({ ...editFormData, room_number: e.target.value })}
                        className="mt-1"
                        placeholder="e.g., 101, 201"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    {(user.grade || user.section || user.room_number) && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Grade / Section / Room Number</label>
                        <p className="text-base">
                          {[user.grade, user.section, user.room_number].filter(Boolean).join(' / ') || '-'}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Students (only for teachers) */}
          {user.role === 'teacher' && (
            <Card>
              <CardHeader>
                <CardTitle>Students</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Students assigned to this teacher's sections.
                </p>
              </CardHeader>
              <CardContent>
                {teacherStudents.length > 0 ? (
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student ID</TableHead>
                          <TableHead>Student Name</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teacherStudents.map((s) => (
                          <TableRow key={s.id}>
                            <TableCell>{s.student_identifier ?? '-'}</TableCell>
                            <TableCell>{s.full_name}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No students assigned.</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* System Information */}
          <Card>
            <CardHeader>
              <CardTitle>System Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Created</label>
                <p className="text-base">
                  {new Date(user.created_at).toLocaleString('en-US', {
                    year: 'numeric',
                    month: 'numeric',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Account Management */}
          <Card>
            <CardHeader>
              <CardTitle>Account Management</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="space-y-3">
                  <div>
                    <h4 className="text-sm font-semibold mb-1">Account Status</h4>
                    <p className="text-xs text-muted-foreground mb-3">
                      Deactivate this account to prevent user login and access. The user's data will be preserved.
                    </p>
                  </div>
                  <UserManagementActions
                    userId={user.id}
                    isApproved={user.is_approved}
                    isActive={user.is_active}
                    role={user.role}
                    view="directory"
                    isSelf={isSelf}
                    onUserUpdated={handleUserUpdated}
                  />
                  {!isSelf && (
                    <div className="pt-4 border-t border-gray-200">
                      <Button
                        variant="destructive"
                        size="sm"
                        className="gap-2"
                        onClick={() => setDeleteConfirmOpen(true)}
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Staff
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Roles & Permissions Tab */}
      {activeTab === 'roles' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Assign Roles & Permissions</CardTitle>
              <p className="text-sm text-muted-foreground">
                Select a role for this user. Only one role can be assigned at a time. Changing the role will replace the current role.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(Object.keys(ROLE_PERMISSIONS) as Role[]).map((role) => {
                  const isCurrentRole = user.role === role
                  return (
                    <Card
                      key={role}
                      className={`transition-all hover:shadow-lg ${
                        isCurrentRole ? 'ring-2 ring-purple-500' : ''
                      }`}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-3">
                          <div className="text-4xl">{ROLE_ICONS[role]}</div>
                          <div className="flex items-center gap-2">
                            {isCurrentRole && (
                              <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-700 font-medium">
                                ACTIVE
                              </span>
                            )}
                            <Checkbox
                              checked={isCurrentRole}
                              disabled={updatingRole}
                              onChange={(e) => {
                                e.stopPropagation()
                                // When checking a different role, it replaces the current role
                                if (e.target.checked && !isCurrentRole) {
                                  handleRoleUpdate(role)
                                }
                                // Don't allow unchecking - user must have at least one role
                                // If they want to change, they check a different role
                              }}
                              onClick={(e) => {
                                e.stopPropagation()
                                // Prevent unchecking the current role
                                if (isCurrentRole && !(e.target as HTMLInputElement).checked) {
                                  e.preventDefault()
                                }
                              }}
                            />
                          </div>
                        </div>
                        <h3 className="font-semibold text-lg mb-2 capitalize">
                          {role.replace('_', ' ')}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          {ROLE_DESCRIPTIONS[role]}
                        </p>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground mb-2">Permissions:</p>
                          <ul className="text-xs space-y-1">
                            {ROLE_PERMISSIONS[role].map((permission, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="text-purple-500 mt-1">•</span>
                                <span>{permission}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {passwordData && (
        <TemporaryPasswordDialog
          open={showPasswordDialog}
          onOpenChange={(open) => {
            setShowPasswordDialog(open)
            if (!open) {
              // Dialog closed, refresh data
              setIsEditing(false)
              window.location.reload()
            }
          }}
          fullName={passwordData.fullName}
          role={passwordData.role}
          password={passwordData.password}
          successMessage="Profile Updated Successfully"
        />
      )}

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Delete Staff</DialogTitle>
            <DialogDescription>
              This will permanently remove this staff member and all their data, including all attendance records they created or are linked to. This action cannot be undone. If this staff member is a teacher and they are the only teacher for a grade and section, that grade and section (and its students) will also be deleted. Do you still wish to proceed?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} disabled={deleting}>
              No
            </Button>
            <Button variant="destructive" onClick={handleDeleteStaff} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Yes, delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
