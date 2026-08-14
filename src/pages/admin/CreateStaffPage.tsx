import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Role } from '@/lib/types'
import { isValidEmail, validateTeacherSection } from '@/lib/utils'
import { TemporaryPasswordDialog } from '@/components/admin/TemporaryPasswordDialog'
import { StaffBulkUpload } from '@/features/admin/StaffBulkUpload'

const supabase = createSupabaseBrowserClient()

type CreateStaffPageProps = {
  onStaffCreated: () => void
  basePath?: string  // e.g., '/admin/users' or '/principal/staff-management'
}

export function CreateStaffPage({ onStaffCreated, basePath = '/admin/users' }: CreateStaffPageProps) {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    full_name: '',
    role: 'teacher' as Role,
    email: '',
    mobile: '',
    grade: '',
    section: '',
    room_number: '',
    description: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [passwordData, setPasswordData] = useState<{
    fullName: string
    role: string
    password: string
  } | null>(null)
  const [createdUserId, setCreatedUserId] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Validation
      if (!formData.full_name.trim()) {
        toast.error('Full name is required')
        return
      }

      // For teachers, grade, section, and room_number are required
      if (formData.role === 'teacher') {
        if (!formData.grade.trim() || !formData.section.trim() || !formData.room_number.trim()) {
          toast.error('Grade, section, and room number are required for teachers')
          return
        }
        const sectionCheck = validateTeacherSection(formData.grade, formData.section)
        if (sectionCheck.ok === false) {
          toast.error(sectionCheck.error)
          return
        }
      }

      if (formData.email.trim() && !isValidEmail(formData.email)) {
        toast.error('Invalid email format. Use an address like name@catamilacademy.org or name@gmail.com.')
        return
      }

      // Description is optional for all roles including volunteers

      // Get session for authentication
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('Please log in to continue')
        return
      }

      // Prepare payload
      const payload: any = {
        full_name: formData.full_name.trim(),
        role: formData.role,
        mobile: formData.mobile.trim() || null,
        grade: formData.grade.trim() || null,
        section: formData.section.trim() || null,
        room_number: formData.room_number.trim() || null,
        description: formData.description.trim() || null,
      }

      // Email is optional
      if (formData.email.trim()) {
        payload.email = formData.email.trim()
      }

      // Call API
      const response = await fetch('/api/admin/users/create', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || data.detail || 'Failed to create staff')
      }

      // Store the created user ID for navigation
      if (data.profile_id) {
        setCreatedUserId(data.profile_id)
      }
      
      // Show password dialog if temporary password is provided (when email was provided)
      // Otherwise show success dialog (when no email was provided)
      setPasswordData({
        fullName: data.full_name || formData.full_name,
        role: data.role || formData.role,
        password: data.temporary_password || '', // Will be empty if no email was provided
      })
      setShowPasswordDialog(true)
      
      // Reset form
      setFormData({
        full_name: '',
        role: 'teacher',
        email: '',
        mobile: '',
        grade: '',
        section: '',
        room_number: '',
        description: '',
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create staff'
      toast.error(errorMessage)
      console.error('Error creating staff:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const isTeacher = formData.role === 'teacher'
  const isVolunteer = formData.role === 'volunteer'

  return (
    <div className="space-y-6">
    <Card>
      <CardHeader>
        <CardTitle>Add a Single Staff</CardTitle>
        <p className="text-sm text-muted-foreground font-normal pt-1">
          Create one staff member at a time.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="full_name">Full Name *</Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              placeholder="First_Name Last_Name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role *</Label>
            <Select
              value={formData.role}
              onValueChange={(value) => setFormData({ ...formData, role: value as Role })}
            >
              <SelectTrigger id="role">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="teacher">Teacher</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="principal">Principal</SelectItem>
                <SelectItem value="attendance_officer">Attendance Officer</SelectItem>
                <SelectItem value="hscp_officer">HSCP Officer</SelectItem>
                <SelectItem value="volunteer">Volunteer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email (Optional)</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="Enter email (optional)"
            />
            <p className="text-xs text-muted-foreground">
              Email is optional now, but required for the staff member to log in.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mobile">Mobile (Optional)</Label>
            <Input
              id="mobile"
              value={formData.mobile}
              onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
              placeholder="Enter mobile number"
            />
          </div>

          {isTeacher && (
            <>
              <div className="space-y-2">
                <Label htmlFor="grade">Grade *</Label>
                <Input
                  id="grade"
                  value={formData.grade}
                  onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                  placeholder="e.g., 1, 2, HSCP-1, HSCP-2"
                  required={isTeacher}
                />
                <p className="text-xs text-muted-foreground">
                  HSCP grades will be normalized automatically (e.g., "Hscp 1" → "HSCP-1")
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="section">Section *</Label>
                <Input
                  id="section"
                  value={formData.section}
                  onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                  placeholder="e.g., A, B (or Reading / Writing / Conversation for HSCP)"
                  required={isTeacher}
                />
                <p className="text-xs text-muted-foreground">
                  Regular grades: one letter (A–Z). HSCP grades: Reading, Writing, or Conversation.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="room_number">Room Number *</Label>
                <Input
                  id="room_number"
                  value={formData.room_number}
                  onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
                  placeholder="e.g., 101, 201"
                  required={isTeacher}
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={
                isVolunteer
                  ? 'e.g., Parent Helper, Community Volunteer'
                  : 'Optional description or title'
              }
            />
            {isVolunteer && (
              <p className="text-xs text-muted-foreground">
                If provided, this is shown as &quot;Volunteer - Description&quot; in staff lists.
              </p>
            )}
          </div>

          <div className="flex gap-4">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Staff'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFormData({
                  full_name: '',
                  role: 'teacher',
                  email: '',
                  mobile: '',
                  grade: '',
                  section: '',
                  room_number: '',
                  description: '',
                })
              }}
            >
              Reset
            </Button>
          </div>
        </form>
      </CardContent>
      
      {passwordData && (
        <TemporaryPasswordDialog
          open={showPasswordDialog}
          onOpenChange={(open) => {
            setShowPasswordDialog(open)
            // Navigate after dialog closes (when OK is clicked)
            if (!open) {
              if (createdUserId && basePath === '/admin/users') {
                navigate(`/admin/users/${createdUserId}`)
              } else {
                // Fallback: go to directory
                onStaffCreated()
                navigate(`${basePath}?tab=directory`)
              }
            }
          }}
          fullName={passwordData.fullName}
          role={passwordData.role}
          password={passwordData.password}
          successMessage="Staff Created Successfully"
        />
      )}
    </Card>

    <StaffBulkUpload onSuccess={onStaffCreated} />
    </div>
  )
}

