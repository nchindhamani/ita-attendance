import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

const supabase = createSupabaseBrowserClient()

export default function ForcePasswordResetPage() {
  const navigate = useNavigate()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    // Check if user is logged in
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        navigate('/auth/login')
        return
      }

      // Check if user actually needs password reset
      const { data: profile } = await supabase
        .from('profiles')
        .select('requires_password_reset')
        .eq('id', session.user.id)
        .single()

      if (!profile?.requires_password_reset) {
        // User doesn't need password reset, redirect to dashboard
        navigate('/dashboard')
      }
    }
    checkSession()
  }, [navigate])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsPending(true)
    setError(null)

    // Validation
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters long.')
      setIsPending(false)
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      setIsPending(false)
      return
    }

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Not authenticated. Please sign in again.')
        setIsPending(false)
        return
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      })

      if (updateError) {
        setError(updateError.message || 'Failed to update password.')
        setIsPending(false)
        return
      }

      // Clear requires_password_reset flag
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ requires_password_reset: false })
        .eq('id', user.id)

      if (profileError) {
        console.warn(`Failed to clear requires_password_reset flag: ${profileError.message}`)
        // Don't fail the whole operation, just log the warning
      }

      toast.success('Password updated successfully!')
      
      // Redirect to dashboard
      navigate('/dashboard')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.'
      setError(errorMessage)
      setIsPending(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Set Your Password Upon First Login</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-muted-foreground mb-4">
            You are required to set a new password before continuing. This is a one-time setup for your account.
          </p>
            
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter new password"
                required
                disabled={isPending}
                minLength={6}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
                disabled={isPending}
                minLength={6}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isPending}
            >
              {isPending ? 'Updating...' : 'Set Password'}
            </Button>
          </form>
        </CardContent>
      </Card>
  )
}

