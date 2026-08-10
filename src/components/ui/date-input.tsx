import * as React from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Formats a YYYY-MM-DD date string to MM-DD-YYYY for display.
 */
function formatToDisplay(isoDate: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return "";
  const [year, month, day] = isoDate.split("-");
  return `${month}-${day}-${year}`;
}

function toIso(year: number, monthIndex: number, day: number): string {
  const m = String(monthIndex + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

function parseIso(iso: string): { year: number; monthIndex: number; day: number } | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return { year: y, monthIndex: m - 1, day: d };
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const POPOVER_WIDTH = 300;
const POPOVER_GAP = 8;

interface DateInputProps {
  value: string; // YYYY-MM-DD
  onChange: (isoDate: string) => void;
  max?: string; // YYYY-MM-DD
  min?: string; // YYYY-MM-DD
  className?: string;
  disabled?: boolean;
  /** When set, only these YYYY-MM-DD values are selectable (working days). Highlighted in blue. */
  allowedDates?: string[];
  onDisallowedDate?: (isoDate: string) => void;
}

const DateInput = React.forwardRef<HTMLDivElement, DateInputProps>(
  ({ value, onChange, max, min, className, disabled, allowedDates, onDisallowedDate }, ref) => {
    const rootRef = React.useRef<HTMLDivElement | null>(null);
    const panelRef = React.useRef<HTMLDivElement | null>(null);
    const [open, setOpen] = React.useState(false);
    const [coords, setCoords] = React.useState<{ top: number; left: number } | null>(null);

    const allowedSet = React.useMemo(() => {
      if (!allowedDates || allowedDates.length === 0) return null;
      return new Set(allowedDates);
    }, [allowedDates]);

    const initialMonth = React.useMemo(() => {
      const parsed = parseIso(value);
      if (parsed) return { year: parsed.year, monthIndex: parsed.monthIndex };
      if (allowedSet && allowedDates && allowedDates.length > 0) {
        const sorted = [...allowedDates].sort();
        const p = parseIso(sorted[0]);
        if (p) return { year: p.year, monthIndex: p.monthIndex };
      }
      const now = new Date();
      return { year: now.getFullYear(), monthIndex: now.getMonth() };
    }, [value, allowedSet, allowedDates]);

    const [viewYear, setViewYear] = React.useState(initialMonth.year);
    const [viewMonth, setViewMonth] = React.useState(initialMonth.monthIndex);

    const updatePosition = React.useCallback(() => {
      const trigger = rootRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;
      const estimatedHeight = 340;

      let left = rect.left;
      if (left + POPOVER_WIDTH > viewportW - 8) {
        left = Math.max(8, viewportW - POPOVER_WIDTH - 8);
      }

      // Prefer below; flip above if not enough space
      let top = rect.bottom + POPOVER_GAP;
      if (top + estimatedHeight > viewportH - 8 && rect.top > estimatedHeight) {
        top = rect.top - estimatedHeight - POPOVER_GAP;
      }

      setCoords({ top, left });
    }, []);

    React.useEffect(() => {
      if (!open) return;
      setViewYear(initialMonth.year);
      setViewMonth(initialMonth.monthIndex);
      updatePosition();
    }, [open, initialMonth.year, initialMonth.monthIndex, updatePosition]);

    React.useEffect(() => {
      if (!open) return;
      const onPointerDown = (event: MouseEvent) => {
        const target = event.target as Node;
        if (rootRef.current?.contains(target)) return;
        if (panelRef.current?.contains(target)) return;
        setOpen(false);
      };
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") setOpen(false);
      };
      const onReposition = () => updatePosition();

      document.addEventListener("mousedown", onPointerDown);
      document.addEventListener("keydown", onKeyDown);
      window.addEventListener("resize", onReposition);
      window.addEventListener("scroll", onReposition, true);
      return () => {
        document.removeEventListener("mousedown", onPointerDown);
        document.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("resize", onReposition);
        window.removeEventListener("scroll", onReposition, true);
      };
    }, [open, updatePosition]);

    const setRefs = (node: HTMLDivElement | null) => {
      rootRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    };

    const isSelectable = (iso: string): boolean => {
      if (min && iso < min) return false;
      if (max && iso > max) return false;
      if (allowedSet) return allowedSet.has(iso);
      return true;
    };

    const isWorkingDay = (iso: string): boolean => {
      if (!allowedSet) return false;
      return allowedSet.has(iso);
    };

    const handleSelect = (iso: string) => {
      if (!isSelectable(iso)) {
        onDisallowedDate?.(iso);
        return;
      }
      onChange(iso);
      setOpen(false);
    };

    const goPrevMonth = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (viewMonth === 0) {
        setViewMonth(11);
        setViewYear((y) => y - 1);
      } else {
        setViewMonth((m) => m - 1);
      }
    };

    const goNextMonth = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (viewMonth === 11) {
        setViewMonth(0);
        setViewYear((y) => y + 1);
      } else {
        setViewMonth((m) => m + 1);
      }
    };

    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const firstWeekday = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun

    const cells: Array<{ iso: string; day: number; inMonth: boolean } | null> = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({
        iso: toIso(viewYear, viewMonth, day),
        day,
        inMonth: true,
      });
    }

    const calendar = open && !disabled && coords && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={panelRef}
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              width: POPOVER_WIDTH,
              zIndex: 9999,
            }}
            className="rounded-xl border border-[#e5e7eb] bg-white p-3 shadow-[0_12px_28px_rgba(15,23,42,0.18)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={goPrevMonth}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#334155] hover:bg-[#f1f5f9]"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="text-sm font-semibold text-[#0f172a]">
                {MONTHS[viewMonth]} {viewYear}
              </div>
              <button
                type="button"
                onClick={goNextMonth}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#334155] hover:bg-[#f1f5f9]"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-1 grid grid-cols-7 gap-1">
              {WEEKDAYS.map((label) => (
                <div
                  key={label}
                  className="flex h-8 items-center justify-center text-xs font-medium text-[#64748b]"
                >
                  {label}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {cells.map((cell, index) => {
                if (!cell) {
                  return <div key={`empty-${index}`} className="h-9" />;
                }

                const selected = value === cell.iso;
                const working = isWorkingDay(cell.iso);
                const selectable = isSelectable(cell.iso);

                return (
                  <button
                    key={cell.iso}
                    type="button"
                    disabled={!selectable}
                    onClick={() => handleSelect(cell.iso)}
                    className={cn(
                      "flex h-9 w-full items-center justify-center rounded-full text-sm font-medium transition-colors",
                      allowedSet &&
                        !working &&
                        "text-[#cbd5e1] cursor-not-allowed",
                      allowedSet &&
                        working &&
                        !selected &&
                        "bg-[#e0e7ff] text-[#3730a3] hover:bg-[#c7d2fe] cursor-pointer",
                      !allowedSet &&
                        selectable &&
                        !selected &&
                        "text-[#0f172a] hover:bg-[#f1f5f9] cursor-pointer",
                      !allowedSet &&
                        !selectable &&
                        "text-[#cbd5e1] cursor-not-allowed",
                      selected && "bg-[#6366f1] text-white hover:bg-[#4f46e5] cursor-pointer",
                      !selectable && "pointer-events-none"
                    )}
                    aria-label={cell.iso}
                    aria-pressed={selected}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>

            {allowedSet && (
              <p className="mt-2 text-[11px] leading-snug text-[#64748b]">
                Blue dates are working days. Other dates are unavailable.
              </p>
            )}
          </div>,
          document.body
        )
      : null;

    return (
      <div ref={setRefs} className={cn("relative w-full", className)}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (!disabled) setOpen((v) => !v);
          }}
          className={cn(
            "relative flex h-12 w-full items-center rounded-[10px] border-2 border-input bg-background px-4 py-3 text-sm ring-offset-background select-none text-left",
            "shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]",
            "transition-all duration-300 ease-smooth",
            "hover:border-[#6366f1]/50",
            "focus:outline-none focus:ring-2 focus:ring-[#6366f1] focus:ring-offset-2 focus:border-[#6366f1] focus:shadow-[0_0_0_4px_rgba(99,102,241,0.1),inset_0_1px_2px_rgba(0,0,0,0.05)]",
            open && "border-[#6366f1] ring-2 ring-[#6366f1] ring-offset-2",
            disabled && "cursor-not-allowed opacity-50",
            !disabled && "cursor-pointer"
          )}
        >
          <span className={cn("flex-1", !value && "text-[#94a3b8]")}>
            {value ? formatToDisplay(value) : "MM-DD-YYYY"}
          </span>
          <CalendarDays className="h-4 w-4 text-muted-foreground ml-2 shrink-0" />
        </button>
        {calendar}
      </div>
    );
  }
);
DateInput.displayName = "DateInput";

export { DateInput };
