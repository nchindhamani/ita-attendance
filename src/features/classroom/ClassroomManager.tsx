import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import Papa from 'papaparse'
import { toast } from 'sonner'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getCurrentSchoolYear } from '@/lib/school-year'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FileUp, Pencil, Trash2, Upload } from 'lucide-react'

const supabase = createSupabaseBrowserClient()

type Classroom = {
  id: string
  grade: string
  section: string | null
  roomNumber: string | null
  schoolYear: string
}

type Destination = {
  id: string
  grade: string
  section: string
  label: string
}

type ClassroomManagerProps = {
  /** When false, only HSCP grades can be managed (HSCP officer). */
  hscpOnly?: boolean
}

function isHscpGrade(grade: string) {
  return grade.trim().toUpperCase().startsWith('HSCP')
}

/** Collapse HSCP Conversation/Reading/Writing into one row per grade; keep regular sections. */
function groupClassroomsForDisplay(rows: Classroom[]): Classroom[] {
  const result: Classroom[] = []
  const hscpSeen = new Set<string>()

  for (const row of rows) {
    if (!isHscpGrade(row.grade)) {
      result.push(row)
      continue
    }
    if (hscpSeen.has(row.grade)) continue
    hscpSeen.add(row.grade)
    const siblings = rows.filter((r) => r.grade === row.grade)
    const roomNumber =
      siblings.find((s) => s.roomNumber)?.roomNumber ?? row.roomNumber ?? null
    result.push({
      ...row,
      section: null,
      roomNumber,
    })
  }
  return result
}

function parseClassroomCsv(rows: string[][]): Array<{ grade: string; section: string; roomNumber: string }> {
  const out: Array<{ grade: string; section: string; roomNumber: string }> = []
  rows.forEach((row, index) => {
    const grade = String(row[0] ?? '').trim()
    const section = String(row[1] ?? '').trim()
    const roomNumber = String(row[2] ?? '').trim()
    if (!grade && !section && !roomNumber) return
    const g = grade.toLowerCase()
    if (
      index === 0 &&
      (g === 'grade' || g === 'grades') &&
      section.toLowerCase().includes('section')
    ) {
      return
    }
    out.push({ grade, section, roomNumber })
  })
  return out
}

async function authHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error('Not authenticated. Please sign in again.')
  }
  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  }
}

export function ClassroomManager({ hscpOnly = false }: ClassroomManagerProps) {
  const schoolYear = getCurrentSchoolYear()
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [loadingList, setLoadingList] = useState(true)

  const [grade, setGrade] = useState('')
  const [section, setSection] = useState('')
  const [roomNumber, setRoomNumber] = useState('')

  const [fileName, setFileName] = useState<string | null>(null)
  const [parsedRows, setParsedRows] = useState<
    Array<{ grade: string; section: string; roomNumber: string }>
  >([])
  const inputRef = useRef<HTMLInputElement>(null)

  const [isPending, startTransition] = useTransition()

  // Edit room dialog
  const [editTarget, setEditTarget] = useState<Classroom | null>(null)
  const [editRoom, setEditRoom] = useState('')

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<Classroom | null>(null)
  const [deleteMessage, setDeleteMessage] = useState('')
  const [deleteCode, setDeleteCode] = useState<string | null>(null)
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [moveToId, setMoveToId] = useState('')
  const [confirmTeachers, setConfirmTeachers] = useState(false)

  const gradeIsHscp = isHscpGrade(grade)
  const displayClassrooms = groupClassroomsForDisplay(classrooms)

  const reload = useCallback(async () => {
    setLoadingList(true)
    try {
      const headers = await authHeaders()
      const response = await fetch(
        `/api/classrooms?schoolYear=${encodeURIComponent(schoolYear)}`,
        { headers },
      )
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        toast.error(payload.error || 'Failed to load classrooms.')
        setClassrooms([])
        return
      }
      setClassrooms(payload.classrooms || [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load classrooms.')
      setClassrooms([])
    } finally {
      setLoadingList(false)
    }
  }, [schoolYear])

  useEffect(() => {
    void reload()
  }, [reload])

  const onFileSelected = (file: File | null) => {
    if (!file) {
      setFileName(null)
      setParsedRows([])
      return
    }
    setFileName(file.name)
    Papa.parse<string[]>(file, {
      complete: (result) => {
        const rows = (result.data || []) as string[][]
        const parsed = parseClassroomCsv(rows)
        setParsedRows(parsed)
        if (!parsed.length) {
          toast.error('No classroom rows found. CSV needs columns: Grade, Section, Room Number.')
        } else {
          toast.success(`Parsed ${parsed.length} row(s). Click Upload Classrooms to save.`)
        }
      },
      error: () => {
        toast.error('Failed to parse CSV file.')
        setParsedRows([])
      },
    })
  }

  const createOne = () => {
    if (!grade.trim()) {
      toast.error('Grade is required.')
      return
    }
    if (hscpOnly && !isHscpGrade(grade)) {
      toast.error('HSCP officers can only create HSCP classrooms.')
      return
    }
    if (!isHscpGrade(grade) && !section.trim()) {
      toast.error('Section is required for regular grades.')
      return
    }

    startTransition(() => {
      void (async () => {
        try {
          const headers = await authHeaders()
          const response = await fetch('/api/classrooms', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              grade: grade.trim(),
              section: isHscpGrade(grade) ? null : section.trim(),
              roomNumber: roomNumber.trim() || null,
            }),
          })
          const payload = await response.json().catch(() => ({}))
          if (!response.ok) {
            toast.error(payload.error || 'Failed to create classroom.')
            return
          }
          toast.success(payload.success || 'Classroom created.')
          setGrade('')
          setSection('')
          setRoomNumber('')
          await reload()
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'Failed to create classroom.')
        }
      })()
    })
  }

  const uploadBulk = () => {
    if (!parsedRows.length) {
      toast.error('Choose a CSV file first.')
      return
    }
    startTransition(() => {
      void (async () => {
        try {
          const headers = await authHeaders()
          const response = await fetch('/api/classrooms/bulk', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              classrooms: parsedRows.map((r) => ({
                grade: r.grade,
                section: r.section || null,
                roomNumber: r.roomNumber || null,
              })),
            }),
          })
          const payload = await response.json().catch(() => ({}))
          if (!response.ok) {
            toast.error(payload.error || 'Upload failed.')
            return
          }
          toast.success(payload.success || 'Classrooms uploaded.')
          setFileName(null)
          setParsedRows([])
          if (inputRef.current) inputRef.current.value = ''
          await reload()
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'Upload failed.')
        }
      })()
    })
  }

  const openEdit = (row: Classroom) => {
    setEditTarget(row)
    setEditRoom(row.roomNumber || '')
  }

  const saveRoom = () => {
    if (!editTarget) return
    startTransition(() => {
      void (async () => {
        try {
          const headers = await authHeaders()
          const response = await fetch(`/api/classrooms/${editTarget.id}/room`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ roomNumber: editRoom.trim() || null }),
          })
          const payload = await response.json().catch(() => ({}))
          if (!response.ok) {
            toast.error(payload.error || 'Failed to update room number.')
            return
          }
          toast.success(payload.success || 'Room number updated.')
          setEditTarget(null)
          await reload()
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'Failed to update room number.')
        }
      })()
    })
  }

  const openDelete = (row: Classroom) => {
    setDeleteTarget(row)
    setDeleteMessage(
      isHscpGrade(row.grade)
        ? `Delete all ${row.grade} classrooms (Conversation, Reading, Writing) for ${schoolYear}?`
        : `Delete classroom ${row.grade} — ${row.section || ''} for ${schoolYear}?`,
    )
    setDeleteCode(null)
    setDestinations([])
    setMoveToId('')
    setConfirmTeachers(false)
  }

  const runDelete = (opts?: { moveTo?: string; confirmTeachers?: boolean }) => {
    if (!deleteTarget) return
    startTransition(() => {
      void (async () => {
        try {
          const headers = await authHeaders()
          const response = await fetch(`/api/classrooms/${deleteTarget.id}/delete`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              moveAttendanceToSectionId: opts?.moveTo || moveToId || null,
              confirmTeachers: opts?.confirmTeachers ?? confirmTeachers,
            }),
          })
          const payload = await response.json().catch(() => ({}))

          if (response.status === 409) {
            setDeleteCode(payload.code || null)
            setDeleteMessage(payload.error || 'Unable to delete classroom.')
            if (Array.isArray(payload.destinations)) {
              setDestinations(payload.destinations)
            }
            if (payload.code === 'STUDENTS_EXIST') {
              toast.error(payload.error)
            }
            return
          }

          if (!response.ok) {
            toast.error(payload.error || 'Failed to delete classroom.')
            return
          }

          toast.success(payload.success || 'Classroom deleted.')
          setDeleteTarget(null)
          await reload()
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'Failed to delete classroom.')
        }
      })()
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add Classroom</CardTitle>
          <p className="text-sm text-muted-foreground font-normal pt-1">
            School year: {schoolYear}.{' '}
            {hscpOnly
              ? 'HSCP grades create Conversation, Reading, and Writing with the same room number.'
              : 'HSCP grades create Conversation, Reading, and Writing together. Regular grades require a section.'}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="classroom-grade">Grade *</Label>
              <Input
                id="classroom-grade"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                placeholder={hscpOnly ? 'e.g. HSCP 1' : 'e.g. 1 or HSCP 1'}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="classroom-section">
                Section {grade && !gradeIsHscp ? '*' : ''}
              </Label>
              <Input
                id="classroom-section"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                disabled={!grade || gradeIsHscp}
                placeholder={
                  !grade
                    ? 'Enter grade first'
                    : gradeIsHscp
                      ? 'Not required for HSCP'
                      : 'e.g. A'
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="classroom-room">Room Number</Label>
              <Input
                id="classroom-room"
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                placeholder="e.g. 101"
              />
            </div>
            <div className="flex items-end">
              <Button type="button" onClick={createOne} disabled={isPending} className="w-full">
                {isPending ? 'Saving…' : 'Add Classroom'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Bulk Upload CSV
          </CardTitle>
          <p className="text-sm text-muted-foreground font-normal pt-1">
            Columns: <span className="font-medium">Grade</span>,{' '}
            <span className="font-medium">Section</span>,{' '}
            <span className="font-medium">Room Number</span>. Existing grade/section combinations
            are rejected — edit the room number in the list below instead.
          </p>
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
              {isPending ? 'Uploading…' : 'Upload Classrooms'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Classrooms — {schoolYear}</CardTitle>
          <p className="text-sm text-muted-foreground font-normal pt-1">
            HSCP grades show as one row each. Regular grades show section. Edit room numbers only —
            deleting an HSCP grade removes Conversation, Reading, and Writing together.
          </p>
        </CardHeader>
        <CardContent>
          {loadingList ? (
            <p className="text-sm text-muted-foreground">Loading classrooms…</p>
          ) : displayClassrooms.length === 0 ? (
            <p className="text-sm text-muted-foreground">No classrooms for this school year yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Grade</th>
                    <th className="py-2 pr-3 font-medium">Section</th>
                    <th className="py-2 pr-3 font-medium">Room Number</th>
                    <th className="py-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayClassrooms.map((row) => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="py-2.5 pr-3">{row.grade}</td>
                      <td className="py-2.5 pr-3">
                        {isHscpGrade(row.grade) ? '—' : row.section || '—'}
                      </td>
                      <td className="py-2.5 pr-3">{row.roomNumber || '—'}</td>
                      <td className="py-2.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Edit room number"
                            onClick={() => openEdit(row)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Delete classroom"
                            onClick={() => openDelete(row)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Room Number</DialogTitle>
            <DialogDescription>
              {editTarget
                ? isHscpGrade(editTarget.grade)
                  ? `${editTarget.grade} (applies to Conversation, Reading, Writing)`
                  : `${editTarget.grade}${editTarget.section ? ` — ${editTarget.section}` : ''}`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="edit-room">Room Number</Label>
            <Input
              id="edit-room"
              value={editRoom}
              onChange={(e) => setEditRoom(e.target.value)}
              placeholder="e.g. 101"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveRoom} disabled={isPending}>
              {isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Classroom</DialogTitle>
            <DialogDescription>{deleteMessage}</DialogDescription>
          </DialogHeader>

          {deleteCode === 'ATTENDANCE_EXISTS' && (
            <div className="space-y-2">
              <Label htmlFor="move-attendance">Move attendance to</Label>
              <select
                id="move-attendance"
                value={moveToId}
                onChange={(e) => setMoveToId(e.target.value)}
                className="flex h-12 w-full rounded-[10px] border-2 border-input bg-background px-4 py-3 text-sm"
              >
                <option value="">Select destination classroom</option>
                {destinations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {deleteCode === 'TEACHER_ASSIGNED' && (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={confirmTeachers}
                onChange={(e) => setConfirmTeachers(e.target.checked)}
              />
              <span>
                I understand teacher assignments for this classroom will be removed.
              </span>
            </label>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            {deleteCode === 'STUDENTS_EXIST' ? null : (
              <Button
                type="button"
                variant="destructive"
                disabled={
                  isPending ||
                  (deleteCode === 'ATTENDANCE_EXISTS' && !moveToId) ||
                  (deleteCode === 'TEACHER_ASSIGNED' && !confirmTeachers)
                }
                onClick={() => {
                  if (deleteCode === 'ATTENDANCE_EXISTS') {
                    runDelete({ moveTo: moveToId })
                    return
                  }
                  if (deleteCode === 'TEACHER_ASSIGNED') {
                    runDelete({
                      moveTo: moveToId || undefined,
                      confirmTeachers: true,
                    })
                    return
                  }
                  runDelete()
                }}
              >
                {isPending
                  ? 'Deleting…'
                  : deleteCode === 'ATTENDANCE_EXISTS'
                    ? 'Move Attendance & Delete'
                    : deleteCode === 'TEACHER_ASSIGNED'
                      ? 'Confirm Delete'
                      : 'Delete'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
