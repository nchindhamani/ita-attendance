import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Copy, Check, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

type TemporaryPasswordDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  fullName: string
  role: string
  password: string
  successMessage?: string
}

export function TemporaryPasswordDialog({
  open,
  onOpenChange,
  fullName,
  role,
  password,
  successMessage,
}: TemporaryPasswordDialogProps) {
  const [copied, setCopied] = useState(false)

  const formatRole = (role: string) => {
    return role
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const hasPassword = password && password.trim() !== ''
  
  // Copyable message (only this gets copied)
  const copyableMessage = hasPassword
    ? `One-time password for the ${formatRole(role)} ${fullName} to sign in to ITA Attendance Hub for the first time is ${password}. ${fullName} will be required to set a new password after logging in.`
    : `Staff member ${fullName} has been created successfully.`
  
  // Format message with bold name and password for display
  const formatCopyableMessage = (msg: string) => {
    if (hasPassword) {
      // Make the name and password bold
      let formatted = msg.replace(new RegExp(fullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), `<strong class="font-bold">${fullName}</strong>`)
      formatted = formatted.replace(new RegExp(password.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), `<strong class="font-bold">${password}</strong>`)
      return formatted
    } else {
      // For success message without password, make the name bold
      return msg.replace(fullName, `<strong class="font-bold">${fullName}</strong>`)
    }
  }

  const handleCopy = async () => {
    try {
      // Only copy the copyable message, not the header
      await navigator.clipboard.writeText(copyableMessage)
      setCopied(true)
      toast.success('Password message copied to clipboard!')
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      toast.error('Failed to copy to clipboard')
    }
  }

  const handleOk = () => {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            {successMessage || 'Staff Created Successfully'}
          </DialogTitle>
          <DialogDescription>
            {hasPassword 
              ? 'Share this password with the staff member securely for their first login.'
              : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <p 
              className="text-sm text-gray-700 whitespace-pre-line"
              dangerouslySetInnerHTML={{ __html: formatCopyableMessage(copyableMessage) }}
            />
          </div>
          <div className="flex gap-2">
            {hasPassword && (
              <Button
                onClick={handleCopy}
                variant="outline"
                className="flex-1 flex items-center gap-2"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy Message
                  </>
                )}
              </Button>
            )}
            <Button 
              onClick={handleOk} 
              className={hasPassword ? "flex-1" : "w-full"}
            >
              OK
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

