import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRequireActiveProfile } from '@/lib/auth-client'

export default function DashboardPage() {
  const { profile, loading } = useRequireActiveProfile()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading || !profile) return

    // Redirect based on role
    switch (profile.role) {
      case 'admin':
        navigate('/admin', { replace: true })
        break
      case 'principal':
        navigate('/principal', { replace: true })
        break
      case 'attendance_officer':
        navigate('/attendance-officer', { replace: true })
        break
      case 'hscp_officer':
        navigate('/hscp-officer/record-teacher-attendance', { replace: true })
        break
      case 'teacher':
      default:
        navigate('/attendance', { replace: true })
        break
    }
  }, [profile, loading, navigate])

  // Show loading while redirecting
  return (
    <div className="flex items-center justify-center p-8">
      <p className="text-muted-foreground">Loading...</p>
    </div>
  )
}
