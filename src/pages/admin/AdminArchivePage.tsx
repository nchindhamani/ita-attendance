import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArchiveActions } from '@/features/archive/ArchiveActions'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useRequireRole } from '@/lib/auth-client'
import { toast } from 'sonner'

const supabase = createSupabaseBrowserClient()

type ArchiveSettings = {
  current_school_year: string
  archive_status: string
  archive_path: string | null
}

type DownloadLink = {
  label: string
  url: string
}

export default function AdminArchivePage() {
  useRequireRole('admin')
  const navigate = useNavigate()
  
  const [settings, setSettings] = useState<ArchiveSettings | null>(null)
  const [downloadLinks, setDownloadLinks] = useState<DownloadLink[]>([])
  const [loading, setLoading] = useState(true)
  const [preparing, setPreparing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSettings = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        navigate('/auth/login')
        return
      }

      const response = await fetch('/api/admin/archive/settings', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch settings' }))
        throw new Error(errorData.error || errorData.detail || 'Failed to fetch settings')
      }

      const data = await response.json()
      setSettings(data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load archive settings'
      setError(errorMessage)
      console.error('Error fetching settings:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchDownloadLinks = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        return
      }

      const response = await fetch('/api/admin/archive/download-urls', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        console.error('Failed to fetch download URLs')
        return
      }

      const data = await response.json()
      setDownloadLinks(data.links || [])
    } catch (err) {
      console.error('Error fetching download URLs:', err)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [navigate])

  useEffect(() => {
    if (settings?.archive_status === 'ARCHIVE_READY') {
      fetchDownloadLinks()
    }
  }, [settings])

  const handlePrepareArchive = async () => {
    try {
      setPreparing(true)
      setError(null)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        navigate('/auth/login')
        return
      }

      const response = await fetch('/api/admin/archive/prepare', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to prepare archive' }))
        throw new Error(errorData.error || errorData.detail || 'Failed to prepare archive')
      }

      const data = await response.json()
      toast.success(data.success || 'Archive prepared successfully')
      
      // Refresh settings and download links
      await fetchSettings()
      await fetchDownloadLinks()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to prepare archive'
      setError(errorMessage)
      toast.error(errorMessage)
      console.error('Error preparing archive:', err)
    } finally {
      setPreparing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (error && !settings) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <p className="text-destructive">{error}</p>
          <Button onClick={() => fetchSettings()}>Retry</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Archive & Purge</h2>
        <p className="text-sm text-muted-foreground">
          Export attendance data for the school year, verify it, then purge the database.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Archive status: {settings?.archive_status ?? 'IDLE'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            School year: {settings?.current_school_year ?? 'Not set'}
          </p>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          {settings?.archive_status === 'IDLE' ? (
            <Button 
              onClick={handlePrepareArchive}
              disabled={preparing}
            >
              {preparing ? 'Preparing...' : 'Prepare Archive'}
            </Button>
          ) : null}
          {settings?.archive_status ? (
            <ArchiveActions
              status={settings.archive_status as 'IDLE' | 'ARCHIVE_READY' | 'PURGING'}
              downloadLinks={downloadLinks}
              onPurgeComplete={() => {
                fetchSettings()
                setDownloadLinks([])
              }}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
