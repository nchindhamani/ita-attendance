import { useEffect, useMemo, useRef, useState } from 'react'
import { formatPacificDate } from '@/lib/time'
import type { WorkingDaysCalendarType } from '@/lib/school-year'
import {
  calendarTypeForGrade,
  fetchWorkingDays,
  pickDefaultWorkingDate,
} from '@/lib/working-days'

export type WorkingDaysScope =
  | { mode: 'type'; calendarType: WorkingDaysCalendarType }
  | { mode: 'grade'; grade: string | null | undefined }
  | { mode: 'both' } // union of hscp + regular (e.g. All Grades view)

async function loadDates(
  schoolYear: string,
  scope: WorkingDaysScope,
): Promise<string[]> {
  if (scope.mode === 'type') {
    return fetchWorkingDays(schoolYear, scope.calendarType)
  }
  if (scope.mode === 'grade') {
    return fetchWorkingDays(schoolYear, calendarTypeForGrade(scope.grade))
  }
  const [hscp, regular] = await Promise.all([
    fetchWorkingDays(schoolYear, 'hscp'),
    fetchWorkingDays(schoolYear, 'regular'),
  ])
  return [...new Set([...hscp, ...regular])].sort()
}

/**
 * Loads working days for attendance calendars and exposes picker bounds.
 * Optionally syncs the selected date to a sensible default when the list loads.
 */
export function useWorkingDays(options: {
  schoolYear: string
  scope: WorkingDaysScope
  selectedDate: string
  dateParam?: string | null
  onDateResolved?: (isoDate: string) => void
}) {
  const { schoolYear, scope, selectedDate, dateParam, onDateResolved } = options
  const [workingDays, setWorkingDays] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)
  const initializedRef = useRef(false)
  const today = formatPacificDate(new Date())

  const scopeKey =
    scope.mode === 'type'
      ? `type:${scope.calendarType}`
      : scope.mode === 'grade'
        ? `grade:${scope.grade ?? ''}`
        : 'both'

  useEffect(() => {
    let cancelled = false
    setLoaded(false)
    const run = async () => {
      const dates = await loadDates(schoolYear, scope)
      if (cancelled) return
      setWorkingDays(dates)
      setLoaded(true)

      if (!initializedRef.current) {
        initializedRef.current = true
        const preferred = dateParam || pickDefaultWorkingDate(dates, today)
        if (preferred && preferred !== selectedDate) {
          onDateResolved?.(preferred)
        }
      } else if (dates.length && !dates.includes(selectedDate)) {
        const preferred = pickDefaultWorkingDate(dates, today)
        if (preferred) onDateResolved?.(preferred)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolYear, scopeKey])

  const sorted = useMemo(() => [...workingDays].sort(), [workingDays])
  const pickerMin = sorted.length > 0 ? sorted[0] : undefined
  const pickerMax =
    sorted.length > 0
      ? sorted[sorted.length - 1] > today
        ? sorted[sorted.length - 1]
        : today
      : today

  return {
    workingDays,
    loaded,
    today,
    pickerMin,
    pickerMax,
    isWorkingDay: (iso: string) => workingDays.includes(iso),
  }
}
