import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useRequireRole } from '@/lib/auth-client'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Role } from '@/lib/types'
import { toast } from 'sonner'
import { Edit, Save, X, Key } from 'lucide-react'
import { TemporaryPasswordDialog } from '@/components/admin/TemporaryPasswordDialog'

const supabase = createSupabaseBrowserClient()

type Teacher = {
  id: string
  full_name: string | null
  email: string
  role: Role
  grade: string | null
  section: string | null
  mobile: string | null
  room_number: string | null
  is_active: boolean
  is_approved: boolean
  requires_password_reset: boolean | null
  created_at: string
}

export default function AttendanceOfficerTeacherDetailPage() {
  useRequireRole('attendance_officer')
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editFormData, setEditFormData] = useState({
    full_name: '',
    email: '',
    mobile: '',
  })
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [passwordData, setPasswordData] = useState<{
    fullName: string
    role: string
    password: string
  } | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      if (!id) {
        setError('Teacher ID is required')
        setLoading(false)
        return
      }

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
          const errorData = await response.json().catch(() => ({ error: 'Failed to fetch teacher' }))
          throw new Error(errorData.error || errorData.detail || 'Failed to fetch teacher')
        }

        const data = await response.json()
        const allUsers = data.users || []
        const foundTeacher = allUsers.find((u: Teacher) => u.id === id)

        if (!foundTeacher) {
          setError('Teacher not found')
          setLoading(false)
          return
        }

        if (foundTeacher.role !== 'teacher') {
          setError('This user is not a teacher')
          setLoading(false)
          return
        }

        setTeacher(foundTeacher)
        setEditFormData({
          full_name: foundTeacher.full_name || '',
          email: foundTeacher.email || '',
          mobile: foundTeacher.mobile || '',
        })
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load teacher'
        setError(errorMessage)
        console.error('Error fetching teacher:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [id, navigate])

  const handleEdit = () => {
    if (!teacher) return
    setIsEditing(true)
    setEditFormData({
      full_name: teacher.full_name || '',
      email: teacher.email || '',
      mobile: teacher.mobile || '',
    })
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    if (teacher) {
      setEditFormData({
        full_name: teacher.full_name || '',
        email: teacher.email || '',
        mobile: teacher.mobile || '',
      })
    }
  }

  const handleShowTemporaryPassword = async () => {
    if (!teacher || !id) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error('Not authenticated. Please sign in again.')
        return
      }

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

      if (data.temporary_password) {
        setPasswordData({
          fullName: data.full_name || teacher.full_name || '',
          role: data.role || teacher.role,
          password: data.temporary_password,
        })
        setShowPasswordDialog(true)
      } else {
        toast.error('No temporary password available.')
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'An unexpected error occurred.')
    }
  }

  const handleSaveEdit = async () => {
    if (!teacher || !id || isSaving) return

    try {
      setIsSaving(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error('Not authenticated. Please sign in again.')
        setIsSaving(false)
        return
      }

      const payload: Record<string, string | null> = {}
      if (editFormData.full_name !== (teacher.full_name || '')) {
        payload.full_name = editFormData.full_name.trim()
      }
      if (editFormData.email !== (teacher.email || '')) {
        payload.email = editFormData.email.trim() || null
      }
      if (editFormData.mobile !== (teacher.mobile || '')) {
        payload.mobile = editFormData.mobile.trim() || null
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

      if (data.temporary_password && teacher) {
        setPasswordData({
          fullName: data.full_name || teacher.full_name || '',
          role: data.role || teacher.role,
          password: data.temporary_password,
        })
        setShowPasswordDialog(true)
      } else {
        toast.success('Profile updated successfully!', { duration: 2000 })
        setIsEditing(false)
        setTimeout(() => window.location.reload(), 100)
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'An unexpected error occurred.')
      setIsSaving(false)
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

  if (error || !teacher) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <p className="text-destructive">{error || 'Teacher not found'}</p>
          <Button onClick={() => navigate('/attendance-officer/users')}>Back to Staff Directory</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button
            variant="ghost"
            onClick={() => navigate('/attendance-officer/users')}
            className="mb-4"
          >
            ← Back to Staff Directory
          </Button>
          <h2 className="text-[2.5rem] font-heading font-bold text-[#0f172a] leading-tight">
            {teacher.full_name || 'Unknown'}
          </h2>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-20 h-20 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-2xl flex-shrink-0">
              {getInitials(teacher.full_name)}
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
                <h3 className="font-semibold text-2xl mb-1">{teacher.full_name || 'Unknown'}</h3>
              )}
              <p className="text-muted-foreground mb-3">{teacher.email}</p>
              <div className="flex flex-wrap gap-2">
                {teacher.grade && teacher.section && (
                  <span className="px-3 py-1 text-sm rounded-full bg-gray-100 text-gray-700">
                    {teacher.grade}/{teacher.section}
                  </span>
                )}
                <span className={`px-3 py-1 text-sm rounded-full ${
                  teacher.is_active
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {teacher.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        {!isEditing ? (
          <>
            {teacher.requires_password_reset === true && teacher.email && !teacher.email.startsWith('noemail-') && (
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

      <div className="space-y-6">
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
                <p className="text-base">{teacher.email}</p>
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
                <p className="text-base">{teacher.mobile || '-'}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {(teacher.grade || teacher.section || teacher.room_number) && (
          <Card>
            <CardHeader>
              <CardTitle>Teaching Assignment</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-base">
                {[teacher.grade, teacher.section, teacher.room_number].filter(Boolean).join(' / ') || '-'}
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>System Information</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base">
              {new Date(teacher.created_at).toLocaleString('en-US', {
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </p>
          </CardContent>
        </Card>
      </div>

      {passwordData && (
        <TemporaryPasswordDialog
          open={showPasswordDialog}
          onOpenChange={(open) => {
            setShowPasswordDialog(open)
            if (!open) {
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
    </div>
  )
}
