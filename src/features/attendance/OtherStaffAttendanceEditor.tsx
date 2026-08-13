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

const saveOtherStaffAttendance = async (params: {
  attendanceDate: string;
  schoolYear: string;
  entries: { staffId: string; status: string; comments?: string | null }[];
}): Promise<{ success?: string; error?: string }> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return { error: "Not authenticated. Please sign in again." };
    }

    const response = await fetch("/api/other-staff-attendance", {
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

    const contentType = response.headers.get("content-type");
    const responseText = await response.text();
    
    if (!responseText || responseText.trim() === "") {
      return { 
        error: `Server error: ${response.status} ${response.statusText}. Empty response from server.` 
      };
    }
    
    if (!contentType || !contentType.includes("application/json")) {
      return { 
        error: `Server error: ${response.status} ${response.statusText}. ${responseText.substring(0, 200)}` 
      };
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
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

type StaffMember = {
  id: string;
  full_name: string;
  email: string | null;
  role: string;
  description: string | null;
};

type AttendanceEntry = {
  staffId: string;
  status: string;
  comments?: string | null;
};

type ExistingAttendance = Record<
  string,
  { status: AttendanceStatus; comments?: string | null }
>;

const formatRoleLabel = (role: string) => {
  switch (role) {
    case 'admin': return 'Admin';
    case 'attendance_officer': return 'Attendance Officer';
    case 'hscp_officer': return 'HSCP Officer';
    case 'volunteer': return 'Volunteer';
    default: return role.charAt(0).toUpperCase() + role.slice(1);
  }
};

export function OtherStaffAttendanceEditor({
  schoolYear,
  attendanceDate,
  staffMembers,
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
  staffMembers: StaffMember[];
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
  const [activeTab, setActiveTab] = useState<'volunteers' | 'others'>('volunteers');

  const initialEntries = useMemo(() => {
    return staffMembers.map((staff) => ({
      staffId: staff.id,
      status: existing[staff.id]?.status ?? "",
      comments: existing[staff.id]?.comments ?? "",
    }));
  }, [staffMembers, existing]);

  const [entries, setEntries] = useState<AttendanceEntry[]>(initialEntries);
  const prevDateRef = useRef(attendanceDate);
  const prevStaffRef = useRef(staffMembers.map(s => s.id).join(','));

  useEffect(() => {
    const currentStaff = staffMembers.map(s => s.id).join(',');
    if (attendanceDate !== prevDateRef.current || currentStaff !== prevStaffRef.current) {
      setEntries(initialEntries);
      prevDateRef.current = attendanceDate;
      prevStaffRef.current = currentStaff;
    } else if (entries.length === 0 && initialEntries.length > 0) {
      setEntries(initialEntries);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEntries, attendanceDate, staffMembers]);

  const updateEntry = (staffId: string, updates: { status?: string; comments?: string }) => {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.staffId === staffId ? { ...entry, ...updates } : entry
      )
    );
  };

  // Split staff into volunteers and others
  const volunteers = useMemo(() => staffMembers.filter(s => s.role === 'volunteer'), [staffMembers]);
  const otherStaff = useMemo(() => staffMembers.filter(s => s.role !== 'volunteer'), [staffMembers]);

  // Get entries for current tab
  const currentTabStaff = activeTab === 'volunteers' ? volunteers : otherStaff;
  const currentTabEntries = useMemo(() => {
    const ids = new Set(currentTabStaff.map(s => s.id));
    return entries.filter(e => ids.has(e.staffId));
  }, [currentTabStaff, entries]);

  const statistics = useMemo(() => {
    const counts = {
      present: 0,
      absent: 0,
      late: 0,
      left_early: 0,
    };
    currentTabEntries.forEach((entry) => {
      const status = entry.status as AttendanceStatus;
      if (status in counts) {
        counts[status] += 1;
      }
    });
    return counts;
  }, [currentTabEntries]);

  const handleSave = () => {
    if (locked) {
      toast.error("Cannot save attendance for this date.");
      return;
    }
    // Filter to only entries with an explicitly set status
    const entriesToSave = entries.filter((e) => e.status !== "");
    if (entriesToSave.length === 0) {
      toast.error("Please set attendance status for at least one staff member before saving.");
      return;
    }
    startTransition(() => {
      saveOtherStaffAttendance({
        attendanceDate,
        schoolYear,
        entries: entriesToSave,
      }).then((result) => {
        if (result?.error) {
          toast.error(result.error);
        } else {
          toast.success(result?.success ?? "Attendance saved.");
          if (onAttendanceSaved) {
            setTimeout(() => {
              onAttendanceSaved();
            }, 500);
          }
        }
      });
    });
  };

  const handleDownloadCSV = () => {
    if (currentTabStaff.length === 0) {
      toast.error("No staff to download.");
      return;
    }

    const csvRows = currentTabStaff.map((staff) => {
      const entry = entries.find((e) => e.staffId === staff.id);
      return {
        "Name": staff.full_name,
        "Role": staff.role === 'volunteer' && staff.description 
          ? `Volunteer - ${staff.description}` 
          : formatRoleLabel(staff.role),
        "Email": staff.email || "",
        "Status": entry?.status || "Not Recorded",
        "Comments": entry?.comments ?? "",
      };
    });

    const csv = Papa.unparse(csvRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const tabLabel = activeTab === 'volunteers' ? 'volunteers' : 'other-staff';
    const filename = `${tabLabel}-attendance-${attendanceDate}.csv`;
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

  const renderStaffCard = (staff: StaffMember, isMobile: boolean) => {
    const entry = entries.find((item) => item.staffId === staff.id);
    const currentStatus = entry?.status ?? "";
    const showCommentInput = showCommentInputs[staff.id] ?? false;

    const roleDisplay = staff.role === 'volunteer' && staff.description
      ? `Volunteer - ${staff.description}`
      : formatRoleLabel(staff.role);

    const buttons = (
      <>
        {/* Present Button */}
        <button
          type="button"
          onClick={() => !locked && updateEntry(staff.id, { status: "present" })}
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
          onClick={() => !locked && updateEntry(staff.id, { status: "absent" })}
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
          onClick={() => !locked && updateEntry(staff.id, { status: "late" })}
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
          onClick={() => !locked && updateEntry(staff.id, { status: "left_early" })}
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
              [staff.id]: !prev[staff.id],
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
      </>
    );

    return (
      <div
        key={staff.id}
        className="rounded-[12px] border border-[#e5e7eb] bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:translate-y-[-8px] hover:shadow-[0_20px_40px_rgba(0,0,0,0.12)] hover:border-[#6366f1]"
      >
        {isMobile ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <div className="flex-1">
                <p className="font-semibold text-[#0f172a] text-base">
                  {staff.full_name}
                </p>
                <p className="text-xs text-[#64748b] mt-0.5">
                  {roleDisplay}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {buttons}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="font-semibold text-[#0f172a] text-base">
                {staff.full_name}
              </p>
              <p className="text-xs text-[#64748b] mt-0.5">
                {roleDisplay}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {buttons}
            </div>
          </div>
        )}
        {showCommentInput && (
          <div className="mt-3">
            <Input
              value={entry?.comments ?? ""}
              onChange={(event) =>
                updateEntry(staff.id, { comments: event.target.value })
              }
              placeholder="Add a comment..."
              disabled={locked}
              className="w-full"
            />
          </div>
        )}
      </div>
    );
  };

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
                    toast.error("Selected day is not a working day. Choose a working day to save attendance.");
                  }}
                  onChange={(newDate: string) => {
                    if (!newDate || !/^\d{4}-\d{2}-\d{2}$/.test(newDate) || !onDateChange) return;
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

      {/* Tabs */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={activeTab === 'volunteers' ? 'default' : 'outline'}
          onClick={() => setActiveTab('volunteers')}
        >
          Volunteers ({volunteers.length})
        </Button>
        <Button
          size="sm"
          variant={activeTab === 'others' ? 'default' : 'outline'}
          onClick={() => setActiveTab('others')}
        >
          Others ({otherStaff.length})
        </Button>
      </div>

      {/* Statistics Cards */}
      <AttendanceStatistics counts={statistics} />

      {/* Staff Cards */}
      {currentTabStaff.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">
              No {activeTab === 'volunteers' ? 'volunteers' : 'other staff'} found.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop View */}
          <div className="hidden md:block">
            <div className="space-y-3">
              {currentTabStaff.map((staff) => renderStaffCard(staff, false))}
            </div>
          </div>

          {/* Mobile View */}
          <div className="space-y-3 md:hidden">
            {currentTabStaff.map((staff) => renderStaffCard(staff, true))}
          </div>
        </>
      )}
    </div>
  );
}

