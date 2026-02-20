import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRequireActiveProfile } from '@/lib/auth-client'

export default function DashboardPage() {
  const { profile, loading } = useRequireActiveProfile()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading || !profile) return

    // Redirect based on role
    if (profile.role === 'admin') {
      navigate('/admin', { replace: true })
    } else {
      navigate('/teacher', { replace: true })
    }
  }, [profile, loading, navigate])

  // Show loading while redirecting
  return (
    <div className="flex items-center justify-center p-8">
      <p className="text-muted-foreground">Loading...</p>
    </div>
  )
}
