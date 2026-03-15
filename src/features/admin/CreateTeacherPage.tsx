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

export interface CreateTeacherPageProps {
  onTeacherCreated: () => void
  hscpOnly?: boolean
  detailPath: (id: string) => string
  directoryPath: string
}

export function CreateTeacherPage({
  onTeacherCreated,
  hscpOnly = false,
  detailPath,
  directoryPath,
}: CreateTeacherPageProps) {
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
      if (!formData.full_name.trim()) {
        toast.error('Full name is required')
        return
      }

      if (!formData.grade.trim() || !formData.section.trim() || !formData.room_number.trim()) {
        toast.error('Grade, section, and room number are required')
        return
      }

      if (hscpOnly) {
        const gradeUpper = formData.grade.trim().toUpperCase()
        if (!gradeUpper.startsWith('HSCP')) {
          toast.error('Grade must start with HSCP (e.g., HSCP-1, HSCP-2)')
          return
        }
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('Please log in to continue')
        return
      }

      const payload: any = {
        full_name: formData.full_name.trim(),
        role: 'teacher',
        mobile: formData.mobile.trim() || null,
        grade: formData.grade.trim(),
        section: formData.section.trim(),
        room_number: formData.room_number.trim(),
      }

      if (formData.email.trim()) {
        payload.email = formData.email.trim()
      }

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
        throw new Error(data.error || data.detail || 'Failed to create teacher')
      }

      if (data.profile_id) {
        setCreatedUserId(data.profile_id)
      }

      setPasswordData({
        fullName: data.full_name || formData.full_name,
        role: data.role || 'teacher',
        password: data.temporary_password || '',
      })
      setShowPasswordDialog(true)

      setFormData({
        full_name: '',
        email: '',
        mobile: '',
        grade: '',
        section: '',
        room_number: '',
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create teacher'
      toast.error(errorMessage)
      console.error('Error creating teacher:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const title = hscpOnly ? 'Create New HSCP Teacher' : 'Create New Teacher'
  const submitLabel = hscpOnly ? 'Create HSCP Teacher' : 'Create Teacher'
  const gradePlaceholder = hscpOnly ? 'e.g., HSCP-1, HSCP-2' : 'e.g., 3, 4, HSCP-1'
  const gradeHelp = hscpOnly ? 'HSCP-1, HSCP-2, HSCP-3, etc...' : 'Grade 3, Grade 4, HSCP-1, etc...'
  const sectionHelp = hscpOnly ? 'Reading, Writing, Conversation' : 'A, B, 1, Reading, etc...'

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
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
              placeholder={gradePlaceholder}
              required
            />
            <p className="text-xs text-muted-foreground">{gradeHelp}</p>
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
            <p className="text-xs text-muted-foreground">{sectionHelp}</p>
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
              {isSubmitting ? 'Creating...' : submitLabel}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setFormData({
                full_name: '', email: '', mobile: '',
                grade: '', section: '', room_number: '',
              })}
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
            if (!open) {
              if (createdUserId) {
                navigate(detailPath(createdUserId))
              } else {
                onTeacherCreated()
                navigate(directoryPath)
              }
            }
          }}
          fullName={passwordData.fullName}
          role={passwordData.role}
          password={passwordData.password}
          successMessage={`${hscpOnly ? 'HSCP ' : ''}Teacher Created Successfully`}
        />
      )}
    </Card>
  )
}
