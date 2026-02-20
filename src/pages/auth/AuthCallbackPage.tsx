import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

const supabase = createSupabaseBrowserClient()

// Helper function for logging (since console.log works in browser)
const log_info = (msg: string) => {
  console.log('[AuthCallback]', msg)
}

export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Check for hash fragments in the URL (Supabase password reset uses hash fragments)
        // React Router's location.hash doesn't include the hash, so we must use window.location.hash
        const hash = window.location.hash
        if (!hash || hash.length <= 1) {
          // No hash fragments, redirect to home
          log_info('No hash fragments found, redirecting to home')
          navigate('/')
          return
        }

        // Parse hash fragments - hash format: #access_token=...&refresh_token=...&type=recovery
        const hashString = hash.substring(1) // Remove the '#' prefix
        const hashParams = new URLSearchParams(hashString)
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        const type = hashParams.get('type')
        
        console.log('Auth callback - type:', type, 'has tokens:', !!accessToken && !!refreshToken)

        // Check if this is a password recovery link
        if (type === 'recovery' && accessToken && refreshToken) {
          // Set the session using the tokens from the hash
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

          if (sessionError) {
            setError(`Failed to process reset link: ${sessionError.message}`)
            // Redirect to reset page after a delay
            setTimeout(() => {
              navigate('/auth/reset')
            }, 3000)
            return
          }

          // Successfully set session, redirect to update password page
          navigate('/auth/update-password', { replace: true })
        } else if (type === 'email' && accessToken && refreshToken) {
          // Email verification callback
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

          if (sessionError) {
            setError(`Failed to verify email: ${sessionError.message}`)
            setTimeout(() => {
              navigate('/auth/login')
            }, 3000)
            return
          }

          // Redirect to verify email page or dashboard
          navigate('/auth/verify-email', { replace: true })
        } else {
          // Unknown callback type, redirect to home
          navigate('/')
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred'
        console.error('Auth callback error:', err)
        setError(errorMessage)
        setTimeout(() => {
          navigate('/auth/reset')
        }, 3000)
      }
    }

    handleAuthCallback()
    // Note: We don't include location.hash in dependencies because React Router doesn't track hash changes
    // We rely on window.location.hash which is checked inside the effect
  }, [navigate])

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-8">
        <div className="text-center space-y-4">
          <p className="text-destructive">{error}</p>
          <p className="text-sm text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-8">
      <div className="text-center space-y-4">
        <p className="text-muted-foreground">Processing...</p>
      </div>
    </div>
  )
}

