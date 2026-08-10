import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useRequireRole } from '@/lib/auth-client'
import { getCurrentSchoolYear } from '@/lib/school-year'
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
  school_year: string | null
  mobile: string | null
  room_number: string | null
  is_active: boolean
  is_approved: boolean
  requires_password_reset: boolean | null
  created_at: string
}

export default function HSCPOfficerTeacherDetailPage() {
  useRequireRole('hscp_officer')
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
    grade: '',
    section: '',
    room_number: '',
  })
  const [lastAssignment, setLastAssignment] = useState<{
    grade: string
    section: string
    schoolYear: string
  } | null>(null)
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

        // Get session for authentication
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          navigate('/auth/login')
          return
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
          grade: foundTeacher.grade || '',
          section: foundTeacher.section || '',
          room_number: foundTeacher.room_number || '',
        })

        // Prior-year assignment for history message
        const currentYear = getCurrentSchoolYear()
        const { data: historyRows } = await supabase
          .from('teacher_sections')
          .select('section_id, sections!inner(grade, section, school_year)')
          .eq('teacher_id', foundTeacher.id)

        type SectionJoin = { grade?: string; section?: string; school_year?: string }
        const prior = (historyRows || [])
          .map((row) => {
            const section = (row as { sections?: SectionJoin | SectionJoin[] }).sections
            const s = Array.isArray(section) ? section[0] : section
            return {
              grade: (s?.grade || '').trim(),
              section: (s?.section || '').trim(),
              schoolYear: (s?.school_year || '').trim(),
            }
          })
          .filter(
            (a) =>
              a.grade &&
              a.section &&
              a.schoolYear &&
              a.schoolYear !== currentYear &&
              a.grade.toUpperCase().startsWith('HSCP'),
          )
          .sort((a, b) => b.schoolYear.localeCompare(a.schoolYear))
        setLastAssignment(prior[0] || null)
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
      grade: teacher.grade || '',
      section: teacher.section || '',
      room_number: teacher.room_number || '',
    })
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    if (teacher) {
      setEditFormData({
        full_name: teacher.full_name || '',
        email: teacher.email || '',
        mobile: teacher.mobile || '',
        grade: teacher.grade || '',
        section: teacher.section || '',
        room_number: teacher.room_number || '',
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
          fullName: data.full_name || teacher.full_name || '',
          role: data.role || teacher.role,
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

      const payload: any = {}
      if (editFormData.full_name !== (teacher.full_name || '')) {
        payload.full_name = editFormData.full_name.trim()
      }
      if (editFormData.email !== (teacher.email || '')) {
        payload.email = editFormData.email.trim() || null
      }
      if (editFormData.mobile !== (teacher.mobile || '')) {
        payload.mobile = editFormData.mobile.trim() || null
      }
      if (editFormData.grade !== (teacher.grade || '')) {
        payload.grade = editFormData.grade.trim() || null
      }
      if (editFormData.section !== (teacher.section || '')) {
        payload.section = editFormData.section.trim() || null
      }
      if (editFormData.room_number !== (teacher.room_number || '')) {
        payload.room_number = editFormData.room_number.trim() || null
      }

      if (
        (payload.grade !== undefined || payload.section !== undefined) &&
        (!editFormData.grade.trim() || !editFormData.section.trim())
      ) {
        toast.error('Both grade and section are required for HSCP reassignment.')
        setIsSaving(false)
        return
      }
      if (editFormData.grade.trim() && !editFormData.grade.trim().toUpperCase().startsWith('HSCP')) {
        toast.error('HSCP officers can only assign HSCP grades.')
        setIsSaving(false)
        return
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
      if (data.temporary_password && teacher) {
        setPasswordData({
          fullName: data.full_name || teacher.full_name || '',
          role: data.role || teacher.role,
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
          <Button onClick={() => navigate('/hscp-officer/users')}>Back to Staff Directory</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button
            variant="ghost"
            onClick={() => navigate('/hscp-officer/users')}
            className="mb-4"
          >
            ← Back to Staff Directory
          </Button>
          <h2 className="text-[2.5rem] font-heading font-bold text-[#0f172a] leading-tight">
            {teacher.full_name || 'Unknown'}
          </h2>
        </div>
      </div>

      {/* Teacher Card Header */}
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
                {teacher.school_year && (
                  <span className="px-3 py-1 text-sm rounded-full bg-indigo-100 text-indigo-700">
                    {teacher.school_year}
                  </span>
                )}
                {!teacher.school_year && teacher.is_approved && (
                  <span className="px-3 py-1 text-sm rounded-full bg-amber-100 text-amber-800">
                    Not assigned this year
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

      {/* Edit Button */}
      <div className="flex justify-end gap-2">
        {!isEditing ? (
          <>
            {/* Show button if requires_password_reset is true and email exists */}
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

      {/* Details */}
      <div className="space-y-6">
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

        {/* Teaching Assignment — current year; HSCP grades only */}
        <Card>
          <CardHeader>
            <CardTitle>Teaching Assignment</CardTitle>
            {lastAssignment ? (
              <p className="text-sm text-muted-foreground font-normal pt-1">
                {`${teacher.full_name || 'This teacher'} last handled ${lastAssignment.grade} / ${lastAssignment.section} in academic year ${lastAssignment.schoolYear}.`}
              </p>
            ) : null}
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
                    placeholder="e.g., HSCP-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Section</Label>
                  <Input
                    value={editFormData.section}
                    onChange={(e) => setEditFormData({ ...editFormData, section: e.target.value })}
                    className="mt-1"
                    placeholder="e.g., Reading, Writing, Conversation"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Room Number</Label>
                  <Input
                    value={editFormData.room_number}
                    onChange={(e) => setEditFormData({ ...editFormData, room_number: e.target.value })}
                    className="mt-1"
                    placeholder="e.g., 101"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">School Year</label>
                  <p className="text-base">{teacher.school_year || 'Not assigned this year'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Grade / Section / Room Number
                  </label>
                  <p className="text-base">
                    {[teacher.grade, teacher.section, teacher.room_number].filter(Boolean).join(' / ') ||
                      '—'}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* System Information */}
        <Card>
          <CardHeader>
            <CardTitle>System Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Created</label>
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
            </div>
          </CardContent>
        </Card>
      </div>
      
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
    </div>
  )
}

