import { useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const supabase = createSupabaseBrowserClient()

// 15 minutes in milliseconds
const INACTIVITY_TIMEOUT = 15 * 60 * 1000

// Events that count as "user activity"
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousedown',
  'mousemove',
  'keydown',
  'scroll',
  'touchstart',
  'click',
  'wheel',
]

/**
 * Hook that automatically logs out the user after 15 minutes of inactivity.
 * Activity is detected via mouse, keyboard, touch, scroll, and click events.
 * A warning toast is shown 1 minute before logout.
 */
export function useInactivityLogout() {
  const navigate = useNavigate()
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isLoggingOutRef = useRef(false)

  const handleLogout = useCallback(async () => {
    if (isLoggingOutRef.current) return
    isLoggingOutRef.current = true

    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.error('Error signing out:', err)
    }

    toast.info('You have been logged out due to inactivity.', {
      duration: 5000,
    })
    navigate('/auth/login', { replace: true })
  }, [navigate])

  const resetTimer = useCallback(() => {
    // Don't reset if already logging out
    if (isLoggingOutRef.current) return

    // Clear existing timers
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current)

    // Set warning at 14 minutes (1 minute before logout)
    warningTimeoutRef.current = setTimeout(() => {
      toast.warning('You will be logged out in 1 minute due to inactivity.', {
        duration: 10000,
      })
    }, INACTIVITY_TIMEOUT - 60 * 1000)

    // Set logout at 15 minutes
    timeoutRef.current = setTimeout(() => {
      handleLogout()
    }, INACTIVITY_TIMEOUT)
  }, [handleLogout])

  useEffect(() => {
    // Start the timer
    resetTimer()

    // Add event listeners for user activity
    const handleActivity = () => resetTimer()

    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true })
    })

    return () => {
      // Cleanup
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current)

      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity)
      })
    }
  }, [resetTimer])
}

