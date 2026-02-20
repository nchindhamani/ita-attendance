import { useNavigate } from "react-router-dom";
import { useTransition } from "react";
import { Input } from "@/components/ui/input";

interface StudentAttendanceSearchProps {
  initialStudentId?: string;
  initialYear?: string;
  availableYears: string[];
  hasError?: boolean;
}

export function StudentAttendanceSearch({
  initialStudentId = "",
  initialYear = "",
  availableYears,
  hasError: boolean = false, // Currently unused but kept for future error display
}: StudentAttendanceSearchProps) {
  const navigate = useNavigate();
  const [isPending, startTransition] = useTransition();

  const handleStudentIdChange = (value: string) => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== initialStudentId) {
      startTransition(() => {
        navigate(`/admin/student-attendance?studentId=${trimmed}`);
      });
    }
  };

  const handleYearChange = (value: string) => {
    if (value && initialStudentId) {
      startTransition(() => {
        navigate(
          `/admin/student-attendance?studentId=${initialStudentId}&year=${value}`
        );
      });
    }
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
      <div className="w-auto max-w-[180px]">
        <label className="mb-1.5 block text-sm font-medium">Student ID</label>
        <Input
          placeholder="Enter ITA student ID"
          defaultValue={initialStudentId}
          className="w-full"
          onBlur={(e) => handleStudentIdChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleStudentIdChange(e.currentTarget.value);
            }
          }}
        />
      </div>
      <div className="w-auto max-w-[180px]">
        <label className="mb-1.5 block text-sm font-medium">School Year</label>
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          value={initialYear || ""}
          disabled={availableYears.length === 0 || isPending}
          onChange={(e) => handleYearChange(e.target.value)}
        >
          {availableYears.length === 0 ? (
            <option value="">
              {initialStudentId
                ? "No years found for this student"
                : "Enter Student ID first"}
            </option>
          ) : (
            <>
              <option value="">Select school year</option>
              {availableYears.map((yearOption) => (
                <option key={yearOption} value={yearOption}>
                  {yearOption}
                </option>
              ))}
            </>
          )}
        </select>
      </div>
    </div>
  );
}

