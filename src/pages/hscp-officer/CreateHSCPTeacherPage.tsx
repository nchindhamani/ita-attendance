import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { TemporaryPasswordDialog } from '@/components/admin/TemporaryPasswordDialog'

const supabase = createSupabaseBrowserClient()

type CreateHSCPTeacherPageProps = {
  onTeacherCreated: () => void
}

export function CreateHSCPTeacherPage({ onTeacherCreated }: CreateHSCPTeacherPageProps) {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    mobile: '',
    grade: '',
    section: '',
    room_number: '',
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

      if (!formData.grade.trim() || !formData.section.trim() || !formData.room_number.trim()) {
        toast.error('Grade, section, and room number are required')
        return
      }

      // Validate that grade starts with HSCP
      const gradeUpper = formData.grade.trim().toUpperCase()
      if (!gradeUpper.startsWith('HSCP')) {
        toast.error('Grade must start with HSCP (e.g., HSCP-1, HSCP-2)')
        return
      }

      // Get session for authentication
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('Please log in to continue')
        return
      }

      // Prepare payload - role is always 'teacher' for HSCP teachers
      const payload: any = {
        full_name: formData.full_name.trim(),
        role: 'teacher',
        mobile: formData.mobile.trim() || null,
        grade: formData.grade.trim(),
        section: formData.section.trim(),
        room_number: formData.room_number.trim(),
      }

      // Email is optional
      if (formData.email.trim()) {
        payload.email = formData.email.trim()
      }

      // Call API - use the admin create endpoint (HSCP officers can use it too)
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
        throw new Error(data.error || data.detail || 'Failed to create HSCP teacher')
      }

      // Debug logging
      console.log('Create HSCP Teacher Response:', data)
      console.log('Email provided:', formData.email)
      console.log('Temporary password in response:', data.temporary_password)

      // Store the created user ID for navigation
      if (data.profile_id) {
        setCreatedUserId(data.profile_id)
      }
      
      // Show password dialog if temporary password is provided (when email was provided)
      // Otherwise show success dialog (when no email was provided)
      setPasswordData({
        fullName: data.full_name || formData.full_name,
        role: data.role || 'teacher',
        password: data.temporary_password || '', // Will be empty if no email was provided
      })
      setShowPasswordDialog(true)
      
      // Reset form
      setFormData({
        full_name: '',
        email: '',
        mobile: '',
        grade: '',
        section: '',
        room_number: '',
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create HSCP teacher'
      toast.error(errorMessage)
      console.error('Error creating HSCP teacher:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New HSCP Teacher</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="full_name">Full Name *</Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              placeholder="Enter full name"
              required
            />
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
              If no email is provided, a placeholder email will be created. The teacher can log in once an email is added.
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

          <div className="space-y-2">
            <Label htmlFor="grade">Grade *</Label>
            <Input
              id="grade"
              value={formData.grade}
              onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
              placeholder="e.g., HSCP-1, HSCP-2"
              required
            />
            <p className="text-xs text-muted-foreground">
              HSCP-1, HSCP-2, HSCP-3, etc...
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="section">Section *</Label>
            <Input
              id="section"
              value={formData.section}
              onChange={(e) => setFormData({ ...formData, section: e.target.value })}
              placeholder="e.g., A, B, 1"
              required
            />
            <p className="text-xs text-muted-foreground">
              Reading, Writing, Conversation
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="room_number">Room Number *</Label>
            <Input
              id="room_number"
              value={formData.room_number}
              onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
              placeholder="e.g., 101, 201"
              required
            />
          </div>

          <div className="flex gap-4">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create HSCP Teacher'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFormData({
                  full_name: '',
                  email: '',
                  mobile: '',
                  grade: '',
                  section: '',
                  room_number: '',
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
              if (createdUserId) {
                navigate(`/hscp-officer/teachers/${createdUserId}`)
              } else {
                // Fallback: go to directory
                onTeacherCreated()
                navigate('/hscp-officer/users?tab=directory')
              }
            }
          }}
          fullName={passwordData.fullName}
          role={passwordData.role}
          password={passwordData.password}
          successMessage="HSCP Teacher Created Successfully"
        />
      )}
    </Card>
  )
}

