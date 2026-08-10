"use client";

import { useEffect, useMemo, useState, useTransition, useRef } from "react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import Papa from "papaparse";
import { formatPacificDate } from "@/lib/time";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AttendanceStatistics } from "./AttendanceStatistics";
import type { AttendanceStatus } from "@/lib/types";

const supabase = createSupabaseBrowserClient();

const saveTeacherAttendance = async (params: {
  attendanceDate: string;
  schoolYear: string;
  entries: { teacherId: string; status: string; comments?: string | null }[];
}): Promise<{ success?: string; error?: string }> => {
  try {
    // Get JWT token from Supabase session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return { error: "Not authenticated. Please sign in again." };
    }

    // Call Python API
    const response = await fetch("/api/teacher-attendance", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        attendanceDate: params.attendanceDate,
        schoolYear: params.schoolYear,
        entries: params.entries,
      }),
    });

    // Check if response has content before parsing
    const contentType = response.headers.get("content-type");
    const responseText = await response.text();
    
    // Handle empty responses
    if (!responseText || responseText.trim() === "") {
      return { 
        error: `Server error: ${response.status} ${response.statusText}. Empty response from server.` 
      };
    }
    
    // Check if response is JSON
    if (!contentType || !contentType.includes("application/json")) {
      return { 
        error: `Server error: ${response.status} ${response.statusText}. ${responseText.substring(0, 200)}` 
      };
    }

    // Parse JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      return { 
        error: `Failed to parse server response: ${responseText.substring(0, 200)}` 
      };
    }

    if (!response.ok) {
      return { error: data.error || data.detail || "Failed to save attendance" };
    }

    return { success: data.success || "Attendance saved." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
};

type Teacher = {
  id: string;
  full_name: string;
  email: string | null;
  grade: string | null;
  section: string | null;
};

type ExistingAttendance = Record<
  string,
  { status: AttendanceStatus; comments?: string | null }
>;

export function TeacherAttendanceEditor({
  schoolYear,
  attendanceDate,
  teachers,
  existing,
  locked,
  holidayName,
  schoolYearDisplay,
  onAttendanceSaved,
  onDateChange,
  allowedDates,
  lockMessage,
}: {
  schoolYear: string;
  attendanceDate: string;
  teachers: Teacher[];
  existing: ExistingAttendance;
  locked: boolean;
  holidayName?: string | null;
  schoolYearDisplay?: string | null;
  onAttendanceSaved?: () => void | Promise<void>;
  onDateChange?: (date: string) => void;
  allowedDates?: string[];
  lockMessage?: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [showCommentInputs, setShowCommentInputs] = useState<Record<string, boolean>>({});

  const initialEntries = useMemo(() => {
    return teachers.map((teacher) => ({
      teacherId: teacher.id,
      status: existing[teacher.id]?.status ?? "",
      comments: existing[teacher.id]?.comments ?? "",
    }));
  }, [teachers, existing]);

  const [entries, setEntries] = useState(initialEntries);
  const prevDateRef = useRef(attendanceDate);
  const prevTeachersRef = useRef(teachers.map(t => t.id).join(','));

  useEffect(() => {
    // Reset entries when date changes or teachers change
    const currentTeachers = teachers.map(t => t.id).join(',');
    if (attendanceDate !== prevDateRef.current || currentTeachers !== prevTeachersRef.current) {
      console.log('Date or teachers changed, updating entries from existing data:', existing);
      setEntries(initialEntries);
      prevDateRef.current = attendanceDate;
      prevTeachersRef.current = currentTeachers;
    } else if (entries.length === 0 && initialEntries.length > 0) {
      // Only update if entries are empty (initial load)
      console.log('Initial load, setting entries:', initialEntries);
      setEntries(initialEntries);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEntries, attendanceDate, teachers]);

  const updateEntry = (teacherId: string, updates: { status?: AttendanceStatus; comments?: string }) => {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.teacherId === teacherId ? { ...entry, ...updates } : entry
      )
    );
  };

  const statistics = useMemo(() => {
    const counts = {
      present: 0,
      absent: 0,
      late: 0,
      left_early: 0,
    };
    entries.forEach((entry) => {
      const status = entry.status as AttendanceStatus;
      if (status in counts) {
        counts[status] += 1;
      }
    });
    return counts;
  }, [entries]);

  const handleSave = () => {
    if (locked) {
      toast.error("Cannot save attendance for this date.");
      return;
    }
    // Filter to only entries with an explicitly set status
    const entriesToSave = entries.filter((e) => e.status !== "");
    if (entriesToSave.length === 0) {
      toast.error("Please set attendance status for at least one teacher before saving.");
      return;
    }
    console.log('Saving teacher attendance:', { attendanceDate, schoolYear, entries: entriesToSave });
    startTransition(() => {
      saveTeacherAttendance({
        attendanceDate,
        schoolYear,
        entries: entriesToSave,
      }).then((result) => {
        console.log('Save result:', result);
        
        if (result?.error) {
          toast.error(result.error);
        } else {
          toast.success(result?.success ?? "Attendance saved.");
          // Refresh attendance data to ensure it's loaded from database
          if (onAttendanceSaved) {
            // Wait a bit for database to update, then refresh
            setTimeout(() => {
              console.log('Refreshing attendance after save...');
              onAttendanceSaved();
            }, 500);
          }
        }
      });
    });
  };

  const handleDownloadCSV = () => {
    if (teachers.length === 0) {
      toast.error("No teachers to download.");
      return;
    }

    // Create CSV rows from current entries
    const csvRows = teachers.map((teacher) => {
      const entry = entries.find((e) => e.teacherId === teacher.id);
      return {
        "Teacher Name": teacher.full_name,
        "Email": teacher.email || "",
        "Grade": teacher.grade || "",
        "Section": teacher.section || "",
        "Status": entry?.status || "Not Recorded",
        "Comments": entry?.comments ?? "",
      };
    });

    const csv = Papa.unparse(csvRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const filename = `teacher-attendance-${attendanceDate}.csv`;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded successfully.");
  };

  const today = formatPacificDate(new Date());
  const sortedAllowed = allowedDates && allowedDates.length > 0 ? [...allowedDates].sort() : [];
  const pickerMax =
    sortedAllowed.length > 0
      ? sortedAllowed[sortedAllowed.length - 1] > today
        ? sortedAllowed[sortedAllowed.length - 1]
        : today
      : today;
  const pickerMin = sortedAllowed.length > 0 ? sortedAllowed[0] : undefined;

  return (
    <div className="space-y-6">
      {/* School Year */}
      <div className="space-y-1">
        {schoolYearDisplay && (
          <p className="text-sm text-muted-foreground">
            School year: {schoolYearDisplay}
          </p>
        )}
        {/* Holiday messaging disabled — working days are the source of truth */}
        {/* {holidayName ? (
          <p className="text-sm text-emerald-600">
            Holiday: {holidayName}. Attendance is not required today.
          </p>
        ) : null} */}
      </div>

      {/* Date Picker Card with Buttons */}
      <Card>
        <CardHeader className="px-4 pt-2 pb-0">
          <CardTitle className="text-lg mb-0 leading-none">Pick a date</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pt-3 pb-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="sm:max-w-[180px]">
                <DateInput
                  value={attendanceDate}
                  min={pickerMin}
                  max={pickerMax}
                  allowedDates={sortedAllowed.length > 0 ? sortedAllowed : undefined}
                  onDisallowedDate={() => {
                    toast.error("That date is not a working day. Choose a listed class day.");
                  }}
                  onChange={(newDate) => {
                    if (!onDateChange) return;
                    if (sortedAllowed.length > 0) {
                      if (sortedAllowed.includes(newDate)) onDateChange(newDate);
                      return;
                    }
                    if (newDate <= today) onDateChange(newDate);
                  }}
                  className="w-full"
                />
              </div>
              {lockMessage ? (
                <p className="text-sm text-amber-700 leading-snug">{lockMessage}</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <Button onClick={handleSave} disabled={isPending || locked} className="w-full sm:w-auto">
                {isPending ? "Saving..." : "Save attendance"}
              </Button>
              <Button 
                onClick={handleDownloadCSV} 
                variant="outline" 
                className="w-full sm:w-auto"
              >
                Download CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      <AttendanceStatistics counts={statistics} />

      {/* Desktop View */}
      <div className="hidden md:block">
        <div className="space-y-3">
          {teachers.map((teacher) => {
            const entry = entries.find((item) => item.teacherId === teacher.id);
            const currentStatus = entry?.status ?? "";
            const showCommentInput = showCommentInputs[teacher.id] ?? false;
            
            return (
              <div
                key={teacher.id}
                className="rounded-[12px] border border-[#e5e7eb] bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:translate-y-[-8px] hover:shadow-[0_20px_40px_rgba(0,0,0,0.12)] hover:border-[#6366f1]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-[#0f172a] text-base">
                      {teacher.full_name}
                    </p>
                    <p className="text-xs text-[#64748b] mt-0.5">
                      {teacher.grade && teacher.section ? `${teacher.grade} - ${teacher.section}` : teacher.email || ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Present Button */}
                    <button
                      type="button"
                      onClick={() =>
                        !locked && updateEntry(teacher.id, { status: "present" })
                      }
                      disabled={locked}
                      className={`px-3 py-1.5 rounded-[8px] flex items-center justify-center transition-all text-sm font-medium ${
                        currentStatus === "present"
                          ? "bg-white border-2 border-[#10b981] text-[#10b981]"
                          : "bg-white border border-[#e5e7eb] text-[#9ca3af] hover:border-[#d1d5db]"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      Present
                    </button>

                    {/* Absent Button */}
                    <button
                      type="button"
                      onClick={() =>
                        !locked && updateEntry(teacher.id, { status: "absent" })
                      }
                      disabled={locked}
                      className={`px-3 py-1.5 rounded-[8px] flex items-center justify-center transition-all text-sm font-medium ${
                        currentStatus === "absent"
                          ? "bg-white border-2 border-[#ef4444] text-[#ef4444]"
                          : "bg-white border border-[#e5e7eb] text-[#9ca3af] hover:border-[#d1d5db]"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      Absent
                    </button>

                    {/* Late Button */}
                    <button
                      type="button"
                      onClick={() =>
                        !locked && updateEntry(teacher.id, { status: "late" })
                      }
                      disabled={locked}
                      className={`px-3 py-1.5 rounded-[8px] flex items-center justify-center transition-all text-sm font-medium ${
                        currentStatus === "late"
                          ? "bg-white border-2 border-[#f97316] text-[#f97316]"
                          : "bg-white border border-[#e5e7eb] text-[#9ca3af] hover:border-[#d1d5db]"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      Late
                    </button>

                    {/* Left Early Button */}
                    <button
                      type="button"
                      onClick={() =>
                        !locked && updateEntry(teacher.id, { status: "left_early" })
                      }
                      disabled={locked}
                      className={`px-3 py-1.5 rounded-[8px] flex items-center justify-center transition-all text-sm font-medium ${
                        currentStatus === "left_early"
                          ? "bg-white border-2 border-[#8b5cf6] text-[#8b5cf6]"
                          : "bg-white border border-[#e5e7eb] text-[#9ca3af] hover:border-[#d1d5db]"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      Left Early
                    </button>

                    {/* Comment Button */}
                    <button
                      type="button"
                      onClick={() =>
                        setShowCommentInputs((prev) => ({
                          ...prev,
                          [teacher.id]: !prev[teacher.id],
                        }))
                      }
                      className={`px-3 py-1.5 rounded-[8px] flex items-center justify-center bg-white transition-all text-sm font-medium ${
                        entry?.comments && entry.comments.trim()
                          ? "border-2 border-[#3b82f6] text-[#3b82f6]"
                          : "border border-[#e5e7eb] text-[#9ca3af] hover:border-[#d1d5db]"
                      }`}
                    >
                      Comments
                    </button>
                  </div>
                </div>
                {showCommentInput && (
                  <div className="mt-3">
                    <Input
                      value={entry?.comments ?? ""}
                      onChange={(event) =>
                        updateEntry(teacher.id, { comments: event.target.value })
                      }
                      placeholder="Add a comment..."
                      disabled={locked}
                      className="w-full"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile View */}
      <div className="space-y-3 md:hidden">
        {teachers.map((teacher) => {
          const entry = entries.find((item) => item.teacherId === teacher.id);
          const currentStatus = entry?.status ?? "";
          const showCommentInput = showCommentInputs[teacher.id] ?? false;
          
          return (
            <div
              key={teacher.id}
              className="rounded-[12px] border border-[#e5e7eb] bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:translate-y-[-8px] hover:shadow-[0_20px_40px_rgba(0,0,0,0.12)] hover:border-[#6366f1]"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex-1">
                  <p className="font-semibold text-[#0f172a] text-base">
                    {teacher.full_name}
                  </p>
                  <p className="text-xs text-[#64748b] mt-0.5">
                    {teacher.grade && teacher.section ? `${teacher.grade} - ${teacher.section}` : teacher.email || ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Present Button */}
                <button
                  type="button"
                  onClick={() =>
                    !locked && updateEntry(teacher.id, { status: "present" })
                  }
                  disabled={locked}
                  className={`px-3 py-1.5 rounded-[8px] flex items-center justify-center transition-all text-sm font-medium ${
                    currentStatus === "present"
                      ? "bg-white border-2 border-[#10b981] text-[#10b981]"
                      : "bg-white border border-[#e5e7eb] text-[#9ca3af] hover:border-[#d1d5db]"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  Present
                </button>

                {/* Absent Button */}
                <button
                  type="button"
                  onClick={() =>
                    !locked && updateEntry(teacher.id, { status: "absent" })
                  }
                  disabled={locked}
                  className={`px-3 py-1.5 rounded-[8px] flex items-center justify-center transition-all text-sm font-medium ${
                    currentStatus === "absent"
                      ? "bg-white border-2 border-[#ef4444] text-[#ef4444]"
                      : "bg-white border border-[#e5e7eb] text-[#9ca3af] hover:border-[#d1d5db]"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  Absent
                </button>

                {/* Late Button */}
                <button
                  type="button"
                  onClick={() =>
                    !locked && updateEntry(teacher.id, { status: "late" })
                  }
                  disabled={locked}
                  className={`px-3 py-1.5 rounded-[8px] flex items-center justify-center transition-all text-sm font-medium ${
                    currentStatus === "late"
                      ? "bg-white border-2 border-[#f97316] text-[#f97316]"
                      : "bg-white border border-[#e5e7eb] text-[#9ca3af] hover:border-[#d1d5db]"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  Late
                </button>

                {/* Left Early Button */}
                <button
                  type="button"
                  onClick={() =>
                    !locked && updateEntry(teacher.id, { status: "left_early" })
                  }
                  disabled={locked}
                  className={`px-3 py-1.5 rounded-[8px] flex items-center justify-center transition-all text-sm font-medium ${
                    currentStatus === "left_early"
                      ? "bg-white border-2 border-[#8b5cf6] text-[#8b5cf6]"
                      : "bg-white border border-[#e5e7eb] text-[#9ca3af] hover:border-[#d1d5db]"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  Left Early
                </button>

                {/* Comment Button */}
                <button
                  type="button"
                  onClick={() =>
                    setShowCommentInputs((prev) => ({
                      ...prev,
                      [teacher.id]: !prev[teacher.id],
                    }))
                  }
                  className={`px-3 py-1.5 rounded-[8px] flex items-center justify-center bg-white transition-all text-sm font-medium ${
                    entry?.comments && entry.comments.trim()
                      ? "border-2 border-[#3b82f6] text-[#3b82f6]"
                      : "border border-[#e5e7eb] text-[#9ca3af] hover:border-[#d1d5db]"
                  }`}
                >
                  Comments
                </button>
              </div>
              {showCommentInput && (
                <div className="mt-3">
                  <Input
                    value={entry?.comments ?? ""}
                    onChange={(event) =>
                      updateEntry(teacher.id, { comments: event.target.value })
                    }
                    placeholder="Add a comment..."
                    disabled={locked}
                    className="w-full"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

