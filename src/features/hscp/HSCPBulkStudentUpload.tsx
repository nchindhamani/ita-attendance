import { useRef, useState, useTransition } from 'react'
import Papa from 'papaparse'
import { toast } from 'sonner'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { FileUp, Upload } from 'lucide-react'

const supabase = createSupabaseBrowserClient()

type ParsedStudent = {
  studentIdentifier: string
  fullName: string
  grade: string
  section?: string
}

type HSCPBulkStudentUploadProps = {
  schoolYear: string
  onSuccess?: () => void | Promise<void>
  /** API path for bulk upload. Default: HSCP-only endpoint */
  endpoint?: string
  /**
   * When true, CSV includes a 4th Section column.
   * Used by Admin Student Management.
   */
  includeSectionColumn?: boolean
}

function looksLikeHeader(id: string, name: string, grade: string, section?: string): boolean {
  const idLower = id.toLowerCase()
  const nameLower = name.toLowerCase()
  const gradeLower = grade.toLowerCase()
  const sectionLower = (section || '').toLowerCase()
  const baseMatch =
    (idLower.includes('id') || idLower.includes('student')) &&
    (nameLower.includes('name') || nameLower.includes('student')) &&
    gradeLower.includes('grade')
  if (!baseMatch) return false
  // If section column present, treat "section" header as header row too
  if (section !== undefined && sectionLower && !sectionLower.includes('section') && sectionLower !== '') {
    // still a header if grade/id/name match; section cell might be empty in header detection
  }
  return true
}

function parseStudentsFromCsv(rows: string[][], includeSectionColumn: boolean): ParsedStudent[] {
  return rows
    .map((row, index) => {
      const id = String(row[0] ?? '').trim()
      const name = String(row[1] ?? '').trim()
      const grade = String(row[2] ?? '').trim()
      const section = includeSectionColumn ? String(row[3] ?? '').trim() : undefined

      if (index === 0 && looksLikeHeader(id, name, grade, section)) {
        // Extra check: if 4th col looks like "section" header, skip
        if (includeSectionColumn) {
          const sectionLower = (section || '').toLowerCase()
          if (
            sectionLower.includes('section') ||
            (id.toLowerCase().includes('id') && name.toLowerCase().includes('name'))
          ) {
            return null
          }
        } else {
          return null
        }
      }

      // Re-check header more strictly for includeSectionColumn
      if (
        index === 0 &&
        includeSectionColumn &&
        id.toLowerCase().includes('id') &&
        name.toLowerCase().includes('name') &&
        grade.toLowerCase().includes('grade')
      ) {
        return null
      }

      if (!id || !name || !grade) {
        return null
      }

      const parsed: ParsedStudent = {
        studentIdentifier: id,
        fullName: name,
        grade,
      }
      if (includeSectionColumn) {
        parsed.section = section || ''
      }
      return parsed
    })
    .filter((row): row is ParsedStudent => Boolean(row))
}

export function HSCPBulkStudentUpload({
  schoolYear,
  onSuccess,
  endpoint = '/api/hscp-students/bulk',
  includeSectionColumn = false,
}: HSCPBulkStudentUploadProps) {
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsedStudents, setParsedStudents] = useState<ParsedStudent[]>([])

  const uploadStudents = async (students: ParsedStudent[]) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      return { error: 'Not authenticated. Please sign in again.' }
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        schoolYear,
        students,
      }),
    })

    const responseText = await response.text()
    let data: { error?: string; detail?: string; success?: string } = {}
    try {
      data = responseText ? JSON.parse(responseText) : {}
    } catch {
      return {
        error: `Server error: ${response.status} ${response.statusText}. ${responseText.substring(0, 200)}`,
      }
    }

    if (!response.ok) {
      return { error: data.error || data.detail || 'Failed to upload roster.' }
    }

    return { success: data.success || 'Roster uploaded.' }
  }

  const clearSelection = () => {
    setFileName(null)
    setParsedStudents([])
    if (inputRef.current) inputRef.current.value = ''
  }

  const expectedColumns = includeSectionColumn
    ? 'Student ID, Student Name, Grade, Section'
    : 'Student ID, Student Name, Grade'

  const handleFileChange = (file: File | undefined) => {
    if (!file) {
      clearSelection()
      return
    }

    Papa.parse<string[]>(file, {
      skipEmptyLines: true,
      complete: (results) => {
        const students = parseStudentsFromCsv(results.data, includeSectionColumn)

        if (students.length === 0) {
          toast.error(`No valid student rows found. Expected columns: ${expectedColumns}.`)
          clearSelection()
          return
        }

        setFileName(file.name)
        setParsedStudents(students)
        toast.success(`${students.length} student(s) ready to upload. Click "Add Students" to continue.`)
      },
      error: () => {
        toast.error('Unable to parse CSV.')
        clearSelection()
      },
    })
  }

  const handleAddStudents = () => {
    if (parsedStudents.length === 0) {
      toast.error('Please choose a CSV file first.')
      return
    }

    startTransition(() => {
      ;(async () => {
        const result = await uploadStudents(parsedStudents)
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success(result.success ?? 'Roster uploaded.')
          clearSelection()
          if (onSuccess) {
            await onSuccess()
          }
        }
      })()
    })
  }

  return (
    <div className="space-y-3 max-w-3xl">
      <p className="text-sm font-medium text-[#0f172a]">Choose CSV file</p>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        disabled={isPending}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0]
          handleFileChange(file)
        }}
      />
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          className="flex items-center gap-2 sm:shrink-0"
          onClick={() => inputRef.current?.click()}
        >
          <FileUp className="w-4 h-4" />
          Browse
        </Button>
        <Button
          type="button"
          onClick={handleAddStudents}
          disabled={isPending || parsedStudents.length === 0}
          className="flex items-center gap-2 sm:shrink-0"
        >
          <Upload className="w-4 h-4" />
          {isPending ? 'Adding...' : 'Add Students'}
        </Button>
      </div>
      {fileName ? (
        <p className="text-sm text-muted-foreground">
          Selected: <span className="font-medium text-[#0f172a]">{fileName}</span>
          {' '}({parsedStudents.length} student{parsedStudents.length === 1 ? '' : 's'})
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Click <span className="font-medium">Browse</span> to choose a <span className="font-medium">.csv</span> file, then click <span className="font-medium">Add Students</span>.
        </p>
      )}
    </div>
  )
}
