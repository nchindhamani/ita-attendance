import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

type SignupFormProps = {
  role: 'teacher' | 'admin'
  requireTeacherFields?: boolean
}

export function SignupForm({ role, requireTeacherFields }: SignupFormProps) {
  const navigate = useNavigate()
  const [isPending, setIsPending] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = useCallback(
    (form: HTMLFormElement) => {
      const formData = new FormData(form)
      const nextErrors: Record<string, string> = {}
      const requiredFields = ['full_name', 'email', 'password']

      if (requireTeacherFields) {
        requiredFields.push('grade', 'section', 'room_number')
      }

      requiredFields.forEach((field) => {
        const value = String(formData.get(field) ?? '').trim()
        if (!value) {
          nextErrors[field] = 'This field is required.'
        }
      })

      setErrors(nextErrors)
      return Object.keys(nextErrors).length === 0
    },
    [requireTeacherFields]
  )

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    if (!validate(e.currentTarget)) {
      return
    }

    setIsPending(true)
    setErrors({})

    const formData = new FormData(e.currentTarget)
    const email = String(formData.get('email') ?? '').trim().toLowerCase()
    const password = String(formData.get('password') ?? '')
    const full_name = String(formData.get('full_name') ?? '').trim()
    const mobile = String(formData.get('mobile') ?? '').trim()
    const grade = String(formData.get('grade') ?? '').trim()
    const section = String(formData.get('section') ?? '').trim()
    const room_number = String(formData.get('room_number') ?? '').trim()

    try {
      // Call Python API for signup
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          full_name,
          mobile: mobile || null,
          grade: grade || null,
          section: section || null,
          room_number: room_number || null,
          role,
        }),
      })

      // Check if response has content before parsing
      const contentType = response.headers.get('content-type')
      const responseText = await response.text()

      // Handle empty responses
      if (!responseText || responseText.trim() === '') {
        toast.error(`Server error: ${response.status} ${response.statusText}. Empty response from server.`)
        setIsPending(false)
        return
      }

      // Check if response is JSON
      if (!contentType || !contentType.includes('application/json')) {
        toast.error(`Server error: ${response.status} ${response.statusText}. ${responseText.substring(0, 200)}`)
        setIsPending(false)
        return
      }

      // Parse JSON
      let data
      try {
        data = JSON.parse(responseText)
      } catch (parseError) {
        toast.error(`Failed to parse server response: ${responseText.substring(0, 200)}`)
        setIsPending(false)
        return
      }

      if (!response.ok) {
        const errorMessage = data.detail || data.error || 'Failed to sign up.'
        toast.error(errorMessage)
        setErrors({ form: errorMessage })
        setIsPending(false)
        return
      }

      // Success
      toast.success('Account created successfully! Please wait for admin approval.')
      // Redirect to login after a short delay
      setTimeout(() => {
        navigate('/auth/login')
      }, 2000)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.'
      toast.error(errorMessage)
      setErrors({ form: errorMessage })
    } finally {
      setIsPending(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <input type="hidden" name="role" value={role} />
      <div className="space-y-2">
        <label htmlFor="full_name" className="text-[0.875rem] font-semibold text-[#1e293b] mb-2 block">
          Full name <span className="text-[#ef4444]">*</span>
        </label>
        <Input
          id="full_name"
          name="full_name"
          placeholder="Vedha S."
          required
          disabled={isPending}
          aria-invalid={Boolean(errors.full_name)}
        />
        {errors.full_name ? <p className="text-xs text-destructive">{errors.full_name}</p> : null}
      </div>
      <div className="space-y-2">
        <label htmlFor="mobile" className="text-sm font-medium">
          Mobile
        </label>
        <Input
          id="mobile"
          name="mobile"
          placeholder="(555) 123-4567"
          disabled={isPending}
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          Email <span className="text-destructive">*</span>
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="teacher@ita.org"
          required
          disabled={isPending}
          aria-invalid={Boolean(errors.email)}
        />
        {errors.email ? <p className="text-xs text-destructive">{errors.email}</p> : null}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="grade" className="text-sm font-medium">
            Grade{requireTeacherFields ? <span className="text-destructive">*</span> : null}
          </label>
          <Input
            id="grade"
            name="grade"
            placeholder="5"
            required={requireTeacherFields}
            disabled={isPending}
            aria-invalid={Boolean(errors.grade)}
          />
          {errors.grade ? <p className="text-xs text-destructive">{errors.grade}</p> : null}
        </div>
        <div className="space-y-2">
          <label htmlFor="section" className="text-sm font-medium">
            Section{requireTeacherFields ? <span className="text-destructive">*</span> : null}
          </label>
          <Input
            id="section"
            name="section"
            placeholder="A"
            required={requireTeacherFields}
            disabled={isPending}
            aria-invalid={Boolean(errors.section)}
          />
          {errors.section ? <p className="text-xs text-destructive">{errors.section}</p> : null}
        </div>
      </div>
      <div className="space-y-2">
        <label htmlFor="room_number" className="text-sm font-medium">
          Room number{requireTeacherFields ? <span className="text-destructive">*</span> : null}
        </label>
        <Input
          id="room_number"
          name="room_number"
          placeholder="Room 12"
          required={requireTeacherFields}
          disabled={isPending}
          aria-invalid={Boolean(errors.room_number)}
        />
        {errors.room_number ? (
          <p className="text-xs text-destructive">{errors.room_number}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium">
          Password <span className="text-destructive">*</span>
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          disabled={isPending}
          aria-invalid={Boolean(errors.password)}
        />
        {errors.password ? <p className="text-xs text-destructive">{errors.password}</p> : null}
      </div>
      {errors.form ? <p className="text-sm text-destructive">{errors.form}</p> : null}
      <Button className="w-full" type="submit" disabled={isPending}>
        {isPending ? 'Creating account...' : 'Create account'}
      </Button>
    </form>
  )
}
