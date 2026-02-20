import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

const supabase = createSupabaseBrowserClient()

export function UpdatePasswordForm() {
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  // Check if user has a valid session (from password reset link)
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('Invalid or expired reset link. Please request a new password reset.')
        toast.error('Invalid or expired reset link.')
      }
    }
    checkSession()
  }, [])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsPending(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const password = String(formData.get('password') ?? '')

    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters long.')
      setIsPending(false)
      return
    }

    try {
      // Use Supabase's updateUser function to update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      })

      if (updateError) {
        setError(updateError.message || 'Failed to update password. Please try again.')
        toast.error(updateError.message || 'Failed to update password.')
      } else {
        toast.success('Password updated successfully! Redirecting to login...')
        // Redirect to login after a short delay
        setTimeout(() => {
          navigate('/auth/login')
        }, 1500)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium">
          New password
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
          disabled={isPending}
          placeholder="Enter new password (min. 6 characters)"
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button className="w-full" type="submit" disabled={isPending}>
        {isPending ? 'Updating...' : 'Update password'}
      </Button>
    </form>
  )
}
