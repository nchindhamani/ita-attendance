import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

const supabase = createSupabaseBrowserClient()

async function purgeArchive(confirmed: boolean): Promise<{ success?: string; error?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      return { error: 'Not authenticated. Please sign in again.' }
    }

    const response = await fetch('/api/admin/archive/purge', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        confirmed: confirmed,
      }),
    })

    const contentType = response.headers.get('content-type')
    const responseText = await response.text()

    if (!responseText || responseText.trim() === '') {
      return {
        error: `Server error: ${response.status} ${response.statusText}. Empty response from server.`,
      }
    }

    if (!contentType || !contentType.includes('application/json')) {
      return {
        error: `Server error: ${response.status} ${response.statusText}. ${responseText.substring(0, 200)}`,
      }
    }

    let data
    try {
      data = JSON.parse(responseText)
    } catch (parseError) {
      return {
        error: `Failed to parse server response: ${responseText.substring(0, 200)}`,
      }
    }

    if (!response.ok) {
      return { error: data.detail || data.error || 'Failed to purge archive.' }
    }

    return { success: data.success || 'Archive purged.' }
  } catch (e: any) {
    return { error: e.message || 'An unexpected error occurred.' }
  }
}

export function ArchiveActions({
  status,
  downloadLinks,
  onPurgeComplete,
}: {
  status: 'IDLE' | 'ARCHIVE_READY' | 'PURGING'
  downloadLinks?: { label: string; url: string }[]
  onPurgeComplete?: () => void
}) {
  const [confirmed, setConfirmed] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handlePurge = () => {
    startTransition(() => {
      purgeArchive(confirmed).then((result) => {
        if (result?.error) {
          toast.error(result.error)
        } else {
          toast.success(result?.success ?? 'Archive purged.')
          if (onPurgeComplete) {
            onPurgeComplete()
          }
        }
      })
    })
  }

  if (status === 'PURGING') {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
        Purging data...
      </div>
    )
  }

  if (status === 'ARCHIVE_READY') {
    return (
      <div className="space-y-4">
        <div className="space-y-2 text-sm text-muted-foreground">
          {downloadLinks?.map((link) => (
            <a
              key={link.label}
              className="block text-primary underline"
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Download {link.label}
            </a>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          I have verified the data.
        </label>
        <Button
          variant="destructive"
          onClick={handlePurge}
          disabled={!confirmed || isPending}
        >
          {isPending ? 'Purging...' : 'Purge Database'}
        </Button>
      </div>
    )
  }

  return null
}
