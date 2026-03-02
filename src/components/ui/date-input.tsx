import * as React from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Formats a YYYY-MM-DD date string to MM-DD-YYYY for display.
 */
function formatToDisplay(isoDate: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return "";
  const [year, month, day] = isoDate.split("-");
  return `${month}-${day}-${year}`;
}

interface DateInputProps {
  value: string; // YYYY-MM-DD
  onChange: (isoDate: string) => void;
  max?: string; // YYYY-MM-DD
  min?: string; // YYYY-MM-DD
  className?: string;
  disabled?: boolean;
}

const DateInput = React.forwardRef<HTMLDivElement, DateInputProps>(
  ({ value, onChange, max, min, className, disabled }, ref) => {
    const hiddenInputRef = React.useRef<HTMLInputElement>(null);

    const handleContainerClick = () => {
      if (disabled) return;
      // Open the native date picker
      if (hiddenInputRef.current) {
        hiddenInputRef.current.showPicker?.();
        hiddenInputRef.current.focus();
      }
    };

    const handleNativeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newDate = e.target.value;
      // Only fire for valid, complete dates (YYYY-MM-DD)
      if (newDate && /^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
        onChange(newDate);
      }
    };

    return (
      <div
        ref={ref}
        onClick={handleContainerClick}
        className={cn(
          "relative flex h-12 w-full items-center rounded-[10px] border-2 border-input bg-background px-4 py-3 text-sm ring-offset-background cursor-pointer select-none",
          "shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]",
          "transition-all duration-300 ease-smooth",
          "hover:border-[#6366f1]/50",
          "focus-within:outline-none focus-within:ring-2 focus-within:ring-[#6366f1] focus-within:ring-offset-2 focus-within:border-[#6366f1] focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.1),inset_0_1px_2px_rgba(0,0,0,0.05)]",
          disabled && "cursor-not-allowed opacity-50",
          className
        )}
      >
        <span className={cn("flex-1", !value && "text-[#94a3b8]")}>
          {value ? formatToDisplay(value) : "MM-DD-YYYY"}
        </span>
        <CalendarDays className="h-4 w-4 text-muted-foreground ml-2 shrink-0" />
        {/* Hidden native date input for the calendar popup */}
        <input
          ref={hiddenInputRef}
          type="date"
          value={value}
          max={max}
          min={min}
          disabled={disabled}
          onChange={handleNativeChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          tabIndex={-1}
        />
      </div>
    );
  }
);
DateInput.displayName = "DateInput";

export { DateInput };

