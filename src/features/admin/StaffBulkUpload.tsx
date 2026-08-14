import { useRef, useState, useTransition } from 'react'
import Papa from 'papaparse'
import { toast } from 'sonner'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { FileUp, Upload } from 'lucide-react'

const supabase = createSupabaseBrowserClient()

export type BulkStaffRow = {
  full_name: string
  role: string
  email?: string
  mobile?: string
  grade?: string
  section?: string
  room_number?: string
  description?: string
}

type BulkFailure = {
  full_name: string
  reason: string
}

type StaffBulkUploadProps = {
  /** When true, Role/Description columns are omitted; role is always teacher. */
  hscpOnly?: boolean
  onSuccess?: () => void | Promise<void>
}

function headerMap(cells: string[]): Record<string, number> {
  const map: Record<string, number> = {}
  cells.forEach((cell, idx) => {
    const key = cell.trim().toLowerCase().replace(/[\s_-]+/g, '')
    if (key) map[key] = idx
  })
  return map
}

function cell(row: string[], map: Record<string, number>, ...keys: string[]): string {
  for (const key of keys) {
    if (key in map) {
      return String(row[map[key]] ?? '').trim()
    }
  }
  return ''
}

function parseStaffCsv(rows: string[][], hscpOnly: boolean): BulkStaffRow[] {
  if (!rows.length) return []

  const first = rows[0].map((c) => String(c ?? '').trim())
  const firstJoined = first.join(' ').toLowerCase()
  const hasHeader =
    firstJoined.includes('name') ||
    firstJoined.includes('role') ||
    firstJoined.includes('email') ||
    firstJoined.includes('grade')

  let dataRows = rows
  let map: Record<string, number>

  if (hasHeader) {
    map = headerMap(first)
    dataRows = rows.slice(1)
  } else if (hscpOnly) {
    // Full Name, Email, Mobile, Grade, Section, Room Number, Description
    map = {
      fullname: 0,
      name: 0,
      email: 1,
      mobile: 2,
      grade: 3,
      section: 4,
      roomnumber: 5,
      room: 5,
      description: 6,
    }
  } else {
    // Full Name, Role, Email, Mobile, Grade, Section, Room Number, Description
    map = {
      fullname: 0,
      name: 0,
      role: 1,
      email: 2,
      mobile: 3,
      grade: 4,
      section: 5,
      roomnumber: 6,
      room: 6,
      description: 7,
    }
  }

  return dataRows
    .map((row) => {
      const full_name = cell(row, map, 'fullname', 'name', 'staffname', 'teachername')
      if (!full_name) return null

      const role = hscpOnly
        ? 'teacher'
        : cell(row, map, 'role') || 'teacher'

      return {
        full_name,
        role,
        email: cell(row, map, 'email') || undefined,
        mobile: cell(row, map, 'mobile', 'phone') || undefined,
        grade: cell(row, map, 'grade') || undefined,
        section: cell(row, map, 'section') || undefined,
        room_number: cell(row, map, 'roomnumber', 'room', 'roomno') || undefined,
        description: cell(row, map, 'description', 'title') || undefined,
      } as BulkStaffRow
    })
    .filter((row): row is BulkStaffRow => Boolean(row))
}

function normalizeFailures(raw: unknown): BulkFailure[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (item && typeof item === 'object' && 'reason' in item) {
        const row = item as { full_name?: string; reason?: string }
        return {
          full_name: (row.full_name || 'Unnamed').trim() || 'Unnamed',
          reason: String(row.reason || 'Unknown error'),
        }
      }
      // Legacy string: "Row 1 (Name): reason"
      const text = String(item || '')
      const match = text.match(/^Row\s+\d+\s+\(([^)]+)\):\s*(.*)$/i)
      if (match) {
        return { full_name: match[1].trim() || 'Unnamed', reason: match[2].trim() || text }
      }
      return { full_name: 'Unnamed', reason: text || 'Unknown error' }
    })
    .filter((f) => f.reason)
}

function successCountMessage(count: number): string {
  if (count <= 0) return 'No staff members were added.'
  if (count === 1) return '1 staff member was added successfully.'
  return `${count} staff members were added successfully.`
}

export function StaffBulkUpload({ hscpOnly = false, onSuccess }: StaffBulkUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [parsedRows, setParsedRows] = useState<BulkStaffRow[]>([])
  const [isPending, startTransition] = useTransition()
  const [resultOpen, setResultOpen] = useState(false)
  const [addedCount, setAddedCount] = useState(0)
  const [failures, setFailures] = useState<BulkFailure[]>([])
  const [pendingRefresh, setPendingRefresh] = useState(false)

  const finishAndMaybeRefresh = async (shouldRefresh: boolean) => {
    clearFile()
    if (shouldRefresh) {
      await onSuccess?.()
    }
  }

  const closeResultDialog = async () => {
    setResultOpen(false)
    const shouldRefresh = pendingRefresh
    setPendingRefresh(false)
    if (shouldRefresh) {
      await finishAndMaybeRefresh(true)
    }
  }
  const onFileSelected = (file: File | null) => {
    if (!file) return
    setFileName(file.name)
    Papa.parse<string[]>(file, {
      skipEmptyLines: true,
      complete: (results) => {
        const rows = (results.data || []) as string[][]
        const parsed = parseStaffCsv(rows, hscpOnly)
        if (!parsed.length) {
          toast.error(
            hscpOnly
              ? 'No staff rows found. CSV needs: Full Name, Email, Mobile, Grade, Section, Room Number, Description.'
              : 'No staff rows found. CSV needs: Full Name, Role, Email, Mobile, Grade, Section, Room Number, Description.'
          )
          setParsedRows([])
          return
        }
        setParsedRows(parsed)
        toast.success(`Parsed ${parsed.length} row(s).`)
      },
      error: () => {
        toast.error('Failed to parse CSV file.')
        setParsedRows([])
      },
    })
  }

  const clearFile = () => {
    setParsedRows([])
    setFileName('')
    if (inputRef.current) inputRef.current.value = ''
  }

  const uploadBulk = () => {
    if (!parsedRows.length) {
      toast.error('Choose a CSV file first.')
      return
    }

    startTransition(() => {
      void (async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession()
          if (!session?.access_token) {
            toast.error('Please log in to continue')
            return
          }

          const response = await fetch('/api/admin/users/bulk', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ staff: parsedRows }),
          })

          const payload = await response.json().catch(() => ({}))
          const added = Number(payload.addedCount ?? 0)
          const failedRows = normalizeFailures(payload.errors)

          // Partial or total failure: show results dialog (do NOT reload yet — dialog would disappear)
          if (failedRows.length > 0) {
            setAddedCount(added)
            setFailures(failedRows)
            setPendingRefresh(added > 0)
            setResultOpen(true)
            return
          }

          if (!response.ok) {
            const detail =
              payload.detail ||
              payload.message ||
              payload.error ||
              'Bulk upload failed.'
            setAddedCount(added)
            setFailures([
              {
                full_name: 'Upload',
                reason: String(detail),
              },
            ])
            setPendingRefresh(false)
            setResultOpen(true)
            return
          }

          // All succeeded — count-only toast, then refresh directory
          toast.success(successCountMessage(added))
          await finishAndMaybeRefresh(true)
        } catch (e) {
          setAddedCount(0)
          setFailures([
            {
              full_name: 'Upload',
              reason: e instanceof Error ? e.message : 'Bulk upload failed.',
            },
          ])
          setPendingRefresh(false)
          setResultOpen(true)
        }
      })()
    })
  }

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Bulk Upload CSV
        </CardTitle>
        <div className="text-sm text-muted-foreground font-normal pt-1 space-y-1">
          {hscpOnly ? (
            <>
              <p>
                Columns: <span className="font-medium">Full Name</span>,{' '}
                <span className="font-medium">Email</span>,{' '}
                <span className="font-medium">Mobile</span>,{' '}
                <span className="font-medium">Grade</span>,{' '}
                <span className="font-medium">Section</span>,{' '}
                <span className="font-medium">Room Number</span>,{' '}
                <span className="font-medium">Description</span> (optional).
              </p>
              <p>Role is always teacher. Grade must be HSCP.</p>
              <p>Section must be Reading, Writing, or Conversation.</p>
            </>
          ) : (
            <>
              <p>
                Columns: <span className="font-medium">Full Name</span>,{' '}
                <span className="font-medium">Role</span>,{' '}
                <span className="font-medium">Email</span>,{' '}
                <span className="font-medium">Mobile</span>,{' '}
                <span className="font-medium">Grade</span>,{' '}
                <span className="font-medium">Section</span>,{' '}
                <span className="font-medium">Room Number</span>,{' '}
                <span className="font-medium">Description</span> (optional).
              </p>
              <p>
                Grade, section, and room are used only when role is teacher; ignored for other roles.
                Regular teacher section must be a single letter (A–Z). HSCP teacher section must be
                Reading, Writing, or Conversation.
              </p>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => onFileSelected(e.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-2"
          >
            <FileUp className="h-4 w-4" />
            Choose CSV
          </Button>
          <span className="text-sm text-muted-foreground">
            {fileName
              ? `${fileName} (${parsedRows.length} row${parsedRows.length === 1 ? '' : 's'})`
              : 'No file selected'}
          </span>
          <Button
            type="button"
            onClick={uploadBulk}
            disabled={isPending || !parsedRows.length}
            className="sm:ml-auto"
          >
            {isPending ? 'Uploading…' : 'Upload Staff'}
          </Button>
        </div>
      </CardContent>
    </Card>

    <Dialog
      open={resultOpen}
      onOpenChange={(open) => {
        if (!open) {
          void closeResultDialog()
        } else {
          setResultOpen(true)
        }
      }}
    >
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk upload results</DialogTitle>
          <DialogDescription>
            {successCountMessage(addedCount)}
            {failures.length > 0
              ? ` ${failures.length} row${failures.length === 1 ? '' : 's'} could not be added.`
              : ''}
          </DialogDescription>
        </DialogHeader>

        {failures.length > 0 && (
          <div className="overflow-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Full Name</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {failures.map((f, idx) => (
                  <TableRow key={`${f.full_name}-${idx}`}>
                    <TableCell className="align-top font-medium">{f.full_name}</TableCell>
                    <TableCell className="align-top text-sm text-muted-foreground">
                      {f.reason}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <DialogFooter>
          <Button type="button" onClick={() => void closeResultDialog()}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
