import { useState, useRef } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

const supabase = createSupabaseBrowserClient()

export function ResetPasswordForm() {
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsPending(true)
    setError(null)
    setSuccess(null)

    const formData = new FormData(e.currentTarget)
    const email = String(formData.get('email') ?? '').trim().toLowerCase()

    if (!email) {
      setError('Please provide your email address.')
      setIsPending(false)
      return
    }

    try {
      // Use Supabase's resetPasswordForEmail function
      // Note: Supabase will redirect to the callback URL with hash fragments
      // The callback handler will process these and redirect to update-password
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback`,
      })

      if (resetError) {
        // Check for email quota limit errors
        const errorMessage = resetError.message || ''
        const isQuotaError = 
          errorMessage.toLowerCase().includes('quota') ||
          errorMessage.toLowerCase().includes('rate limit') ||
          errorMessage.toLowerCase().includes('too many') ||
          resetError.status === 429
        
        if (isQuotaError) {
          const quotaMessage = 'Email quota limit reached. Please try after an hour or contact admin.'
          setError(quotaMessage)
          toast.error(quotaMessage)
        } else {
          setError(errorMessage || 'Failed to send reset email. Please try again.')
          toast.error(errorMessage || 'Failed to send reset email.')
        }
      } else {
        setSuccess('Password reset email sent! Please check your inbox.')
        toast.success('Password reset email sent! Please check your inbox.')
        // Clear the form using ref
        if (formRef.current) {
          formRef.current.reset()
        }
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
    <form ref={formRef} className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="teacher@ita.org"
          required
          disabled={isPending}
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-600">{success}</p> : null}
      <Button className="w-full" type="submit" disabled={isPending}>
        {isPending ? 'Sending...' : 'Send reset link'}
      </Button>
    </form>
  )
}
