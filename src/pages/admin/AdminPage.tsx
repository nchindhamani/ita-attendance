import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useRequireRole } from '@/lib/auth-client'

const supabase = createSupabaseBrowserClient()

export default function AdminPage() {
  useRequireRole('admin')
  const navigate = useNavigate()
  const [pendingCount, setPendingCount] = useState<number | null>(null)
  const [activeCount, setActiveCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        setLoading(true)
        setError(null)

        // Get session for authentication
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          navigate('/auth/login')
          return
        }

        // Fetch all users from backend API (bypasses RLS)
        const response = await fetch('/api/admin/users', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to fetch users' }))
          throw new Error(errorData.error || errorData.detail || 'Failed to fetch users')
        }

        const data = await response.json()
        const allUsers = data.users || []

        // Calculate counts
        const pending = allUsers.filter((user: any) => !user.is_approved).length
        const active = allUsers.filter(
          (user: any) => user.role === 'teacher' && user.is_active && user.is_approved
        ).length

        setPendingCount(pending)
        setActiveCount(active)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load admin overview'
        setError(errorMessage)
        console.error('Error fetching admin overview:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchCounts()
  }, [navigate])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <p className="text-destructive">{error}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-12">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="space-y-3">
          <h2 className="text-[2.5rem] font-heading font-bold text-[#0f172a] leading-tight mb-3">
            Admin Overview
          </h2>
          <p className="text-lg text-[#64748b] font-normal leading-relaxed">
            Approve teachers, review attendance, and manage yearly archives.
          </p>
        </div>
        <Button asChild>
          <Link to="/admin/users?tab=approval">Review pending teachers</Link>
        </Button>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <Link to="/admin/users?tab=approval">
          <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle>Pending approvals</CardTitle>
            </CardHeader>
            <CardContent className="text-[3.5rem] font-bold text-[#0f172a]">
              {pendingCount ?? 0}
            </CardContent>
          </Card>
        </Link>
        <Link to="/admin/users?tab=directory">
          <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle>Active teachers</CardTitle>
            </CardHeader>
            <CardContent className="text-[3.5rem] font-bold text-[#0f172a]">
              {activeCount ?? 0}
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
