import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { createSupabaseBrowserClient } from './supabase/client'
import { Profile, Role } from './types'

const supabase = createSupabaseBrowserClient()

interface AuthState {
  session: any
  profile: Profile | null
  loading: boolean
}

const AuthContext = createContext<AuthState>({
  session: null,
  profile: null,
  loading: true,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        fetchProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        fetchProfile(session.user.id)
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('id,email,full_name,role,is_active,is_approved')
      .eq('id', userId)
      .maybeSingle<Profile>()

    setProfile(data ?? null)
    setLoading(false)
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * Core hook — reads from the shared AuthContext (no duplicate fetches).
 */
export function useAuth() {
  return useContext(AuthContext)
}

/**
 * Convenience hook that redirects unauthenticated / inactive / unapproved users.
 */
export function useRequireActiveProfile() {
  const { session, profile, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading) return

    if (!session || !profile) {
      navigate('/auth/login')
      return
    }

    if (!profile.is_active) {
      navigate('/account-disabled')
      return
    }

    if (!profile.is_approved) {
      navigate('/pending')
      return
    }
  }, [session, profile, loading, navigate])

  return { session, profile, loading }
}

export function useRequireAuth() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && !session) {
      navigate('/auth/login')
    }
  }, [session, loading, navigate])

  return { session, loading }
}

export function useRequireRole(requiredRole: Role) {
  const { session, profile, loading } = useRequireActiveProfile()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading || !profile) return

    if (profile.role !== requiredRole) {
      navigate('/dashboard')
    }
  }, [profile, requiredRole, loading, navigate])

  return { session, profile, loading }
}

