import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import Papa from 'papaparse'
import { toast } from 'sonner'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getCurrentSchoolYear, parseMdYDate, type WorkingDaysCalendarType } from '@/lib/school-year'
import { fetchWorkingDays } from '@/lib/working-days'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { CalendarDays, FileUp, Upload } from 'lucide-react'

const supabase = createSupabaseBrowserClient()

type WorkingDaysManagerProps = {
  /** When false, only HSCP calendar is available (HSCP officer). */
  allowRegularCalendar?: boolean
  defaultCalendarType?: WorkingDaysCalendarType
}

function parseWorkingDaysCsv(rows: string[][]): string[] {
  const dates: string[] = []
  rows.forEach((row, index) => {
    const cell = String(row[0] ?? '').trim()
    if (!cell) return
    const headerish = cell.toLowerCase().replace(/\s+/g, '_')
    if (index === 0 && (headerish === 'working_days' || headerish === 'working_day' || headerish === 'date')) {
      return
    }
    dates.push(cell)
  })
  return dates
}

export function WorkingDaysManager({
  allowRegularCalendar = true,
  defaultCalendarType = 'hscp',
}: WorkingDaysManagerProps) {
  const [calendarType, setCalendarType] = useState<WorkingDaysCalendarType>(
    allowRegularCalendar ? defaultCalendarType : 'hscp',
  )
  const [schoolYear] = useState(getCurrentSchoolYear())
  const [existingDates, setExistingDates] = useState<string[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsedDates, setParsedDates] = useState<string[]>([])
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  const reload = useCallback(async () => {
    setLoadingList(true)
    const dates = await fetchWorkingDays(schoolYear, calendarType)
    setExistingDates(dates)
    setLoadingList(false)
  }, [schoolYear, calendarType])

  useEffect(() => {
    reload()
  }, [reload])

  const onFileSelected = (file: File | null) => {
    if (!file) {
      setFileName(null)
      setParsedDates([])
      return
    }
    setFileName(file.name)
    Papa.parse<string[]>(file, {
      complete: (result) => {
        const rows = (result.data || []) as string[][]
        const dates = parseWorkingDaysCsv(rows)
        setParsedDates(dates)
        if (!dates.length) {
          toast.error("No dates found. CSV needs header 'working_days' and MM/DD/YYYY rows.")
        } else {
          toast.success(`Parsed ${dates.length} date(s). Click Upload Working Days to save.`)
        }
      },
      error: () => {
        toast.error('Failed to parse CSV file.')
        setParsedDates([])
      },
    })
  }

  const upload = () => {
    if (!parsedDates.length) {
      toast.error('Choose a CSV file first.')
      return
    }

    // Client-side validation preview
    const invalid = parsedDates.filter((d) => !parseMdYDate(d))
    if (invalid.length === parsedDates.length) {
      toast.error('All rows look invalid. Use MM/DD/YYYY (e.g. 08/16/2026).')
      return
    }

    startTransition(() => {
      void (async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          toast.error('Not authenticated. Please sign in again.')
          return
        }

        const response = await fetch('/api/working-days/bulk', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            calendarType,
            dates: parsedDates,
          }),
        })

        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
          toast.error(payload.error || 'Upload failed.')
          return
        }

        toast.success(payload.success || `Uploaded ${payload.addedCount ?? 0} working day(s).`)
        setFileName(null)
        setParsedDates([])
        if (inputRef.current) inputRef.current.value = ''
        await reload()
      })()
    })
  }

  const label = calendarType === 'hscp' ? 'HSCP Grades' : 'Regular Grades'

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Working Days
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload class days for school year <span className="font-medium text-foreground">{schoolYear}</span>.
            Attendance can only be recorded on these dates. Non-working dates are blocked.
          </p>

          {allowRegularCalendar ? (
            <div className="space-y-2">
              <Label htmlFor="calendar-type">Calendar</Label>
              <select
                id="calendar-type"
                className="flex h-12 w-full rounded-[10px] border-2 border-input bg-background px-4 text-sm"
                value={calendarType}
                onChange={(e) => setCalendarType(e.target.value as WorkingDaysCalendarType)}
              >
                <option value="hscp">HSCP Grades</option>
                <option value="regular">Regular Grades</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Same one-column CSV for either calendar. Choose which calendar this file updates.
              </p>
            </div>
          ) : (
            <p className="text-sm">
              Calendar: <span className="font-medium">HSCP Grades</span>
            </p>
          )}

          <div className="rounded-[10px] border border-dashed border-input p-4 space-y-3">
            <p className="text-sm font-medium">CSV format (one column)</p>
            <pre className="text-xs bg-muted/50 rounded-md p-3 overflow-x-auto">{`working_days
08/16/2026
08/23/2026`}</pre>
            <p className="text-xs text-muted-foreground">
              Header must be <code>working_days</code>. Dates as <code>MM/DD/YYYY</code>.
              Uploading replaces all working days for the school year(s) in the file for the selected calendar.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => onFileSelected(e.target.files?.[0] ?? null)}
              />
              <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
                <FileUp className="h-4 w-4 mr-2" />
                Browse CSV
              </Button>
              <Button type="button" onClick={upload} disabled={isPending || !parsedDates.length}>
                <Upload className="h-4 w-4 mr-2" />
                {isPending ? 'Uploading…' : 'Upload Working Days'}
              </Button>
              {fileName && (
                <span className="text-sm text-muted-foreground">
                  {fileName} ({parsedDates.length} date{parsedDates.length === 1 ? '' : 's'})
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Current {label} working days — {schoolYear}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingList ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : existingDates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No working days uploaded yet for this calendar.</p>
          ) : (
            <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-sm">
              {existingDates.map((iso) => {
                const [, m, d] = iso.split('-')
                const y = iso.slice(0, 4)
                const display = `${m}/${d}/${y}`
                return (
                  <li key={iso} className="rounded-md border px-2 py-1.5 text-center">
                    {display}
                  </li>
                )
              })}
            </ul>
          )}
          {!loadingList && existingDates.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">{existingDates.length} day(s)</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
