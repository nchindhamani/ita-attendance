import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Role } from '@/lib/types'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

const supabase = createSupabaseBrowserClient()

async function approveUserAsRole(
  userId: string,
  role: string
): Promise<{ success?: string; error?: string }> {
  try {
    // Get JWT token from Supabase session
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      return { error: 'Not authenticated. Please sign in again.' }
    }

    // Call Python API
    const response = await fetch('/api/admin/users/approve', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        profileId: userId,
        role: role,
      }),
    })

    // Check if response has content before parsing
    const contentType = response.headers.get('content-type')
    const responseText = await response.text()

    // Handle empty responses
    if (!responseText || responseText.trim() === '') {
      return {
        error: `Server error: ${response.status} ${response.statusText}. Empty response from server.`,
      }
    }

    // Check if response is JSON
    if (!contentType || !contentType.includes('application/json')) {
      return {
        error: `Server error: ${response.status} ${response.statusText}. ${responseText.substring(0, 200)}`,
      }
    }

    // Parse JSON
    let data
    try {
      data = JSON.parse(responseText)
    } catch (parseError) {
      return {
        error: `Failed to parse server response: ${responseText.substring(0, 200)}`,
      }
    }

    if (!response.ok) {
      return { error: data.detail || data.error || 'Failed to approve user.' }
    }

    return { success: data.success || 'User approved.' }
  } catch (e: any) {
    return { error: e.message || 'An unexpected error occurred.' }
  }
}

async function toggleUserActiveStatus(
  userId: string,
  isActive: boolean
): Promise<{ success?: string; error?: string }> {
  try {
    // Get JWT token from Supabase session
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      return { error: 'Not authenticated. Please sign in again.' }
    }

    // Call Python API
    const response = await fetch('/api/admin/users/toggle-active', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        profileId: userId,
        isActive: isActive,
      }),
    })

    // Check if response has content before parsing
    const contentType = response.headers.get('content-type')
    const responseText = await response.text()

    // Handle empty responses
    if (!responseText || responseText.trim() === '') {
      return {
        error: `Server error: ${response.status} ${response.statusText}. Empty response from server.`,
      }
    }

    // Check if response is JSON
    if (!contentType || !contentType.includes('application/json')) {
      return {
        error: `Server error: ${response.status} ${response.statusText}. ${responseText.substring(0, 200)}`,
      }
    }

    // Parse JSON
    let data
    try {
      data = JSON.parse(responseText)
    } catch (parseError) {
      return {
        error: `Failed to parse server response: ${responseText.substring(0, 200)}`,
      }
    }

    if (!response.ok) {
      return { error: data.detail || data.error || 'Failed to update user status.' }
    }

    return { success: data.success || 'Status updated.' }
  } catch (e: any) {
    return { error: e.message || 'An unexpected error occurred.' }
  }
}

async function updateUserRole(
  userId: string,
  role: string
): Promise<{ success?: string; error?: string }> {
  try {
    // Get JWT token from Supabase session
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      return { error: 'Not authenticated. Please sign in again.' }
    }

    // Call Python API
    const response = await fetch('/api/admin/users/update-role', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        profileId: userId,
        role: role,
      }),
    })

    // Check if response has content before parsing
    const contentType = response.headers.get('content-type')
    const responseText = await response.text()

    // Handle empty responses
    if (!responseText || responseText.trim() === '') {
      return {
        error: `Server error: ${response.status} ${response.statusText}. Empty response from server.`,
      }
    }

    // Check if response is JSON
    if (!contentType || !contentType.includes('application/json')) {
      return {
        error: `Server error: ${response.status} ${response.statusText}. ${responseText.substring(0, 200)}`,
      }
    }

    // Parse JSON
    let data
    try {
      data = JSON.parse(responseText)
    } catch (parseError) {
      return {
        error: `Failed to parse server response: ${responseText.substring(0, 200)}`,
      }
    }

    if (!response.ok) {
      return { error: data.detail || data.error || 'Failed to update user role.' }
    }

    return { success: data.success || 'Role updated.' }
  } catch (e: any) {
    return { error: e.message || 'An unexpected error occurred.' }
  }
}

export function UserManagementActions({
  userId,
  isApproved,
  isActive,
  role,
  view,
  isSelf,
  onUserUpdated,
}: {
  userId: string
  isApproved: boolean
  isActive: boolean
  role: Role
  view: 'approval' | 'directory'
  isSelf?: boolean
  onUserUpdated?: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [teacherGranted, setTeacherGranted] = useState(false)
  const [adminGranted, setAdminGranted] = useState(false)

  const handleApprove = (nextRole: Role) => {
    startTransition(() => {
      approveUserAsRole(userId, nextRole).then((result) => {
        if (result?.error) {
          toast.error(result.error)
        } else {
          toast.success('Access approved successfully.')
          if (onUserUpdated) {
            onUserUpdated()
          }
        }
      })
    })
  }

  const handleActiveToggle = (checked: boolean) => {
    startTransition(() => {
      toggleUserActiveStatus(userId, checked).then((result) => {
        if (result?.error) {
          toast.error(result.error)
        } else {
          toast.success(checked ? 'User activated.' : 'User deactivated.')
          if (onUserUpdated) {
            onUserUpdated()
          }
        }
      }).catch((error) => {
        toast.error('Failed to update user status. Please try again.')
        console.error('Error toggling active status:', error)
      })
    })
  }

  const handleRoleChange = (checked: boolean) => {
    const nextRole: Role = checked ? 'admin' : 'teacher'
    startTransition(() => {
      updateUserRole(userId, nextRole).then((result) => {
        if (result?.error) {
          toast.error(result.error)
        } else {
          toast.success(`User role updated to ${nextRole}.`)
          if (onUserUpdated) {
            onUserUpdated()
          }
        }
      }).catch((error) => {
        toast.error('Failed to update user role. Please try again.')
        console.error('Error updating role:', error)
      })
    })
  }

  if (view === 'approval') {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Switch
            checked={teacherGranted}
            onCheckedChange={() => {
              setTeacherGranted(true)
              handleApprove('teacher')
            }}
            disabled={isPending || isApproved || adminGranted}
          />
          <span className="text-xs text-muted-foreground">Active</span>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={adminGranted}
            onCheckedChange={() => {
              setAdminGranted(true)
              handleApprove('admin')
            }}
            disabled={isPending || isApproved || teacherGranted}
          />
          <span className="text-xs text-muted-foreground">Admin</span>
        </div>
      </div>
    )
  }

  if (isSelf) {
    return (
      <div className="text-xs text-muted-foreground">Current admin</div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <Switch
          checked={isActive}
          onCheckedChange={handleActiveToggle}
          disabled={isPending}
        />
        <span className="text-xs text-muted-foreground">Active</span>
      </div>
      <div className="flex items-center gap-2">
        <Switch
          checked={role === 'admin'}
          onCheckedChange={handleRoleChange}
          disabled={isPending}
        />
        <span className="text-xs text-muted-foreground">Admin</span>
      </div>
    </div>
  )
}
