"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { Check, X, Clock, ArrowRight, Pencil } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
// Table components imported but not used in current implementation
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow,
// } from "@/components/ui/table";
import { Tooltip } from "@/components/ui/tooltip";
import type { AttendanceStatus } from "@/lib/types";
// TODO: Convert these to API calls to /api/attendance
// import {
//   addStudent,
//   addStudentsFromCsv,
//   saveAttendance,
//   type AttendanceEntryInput,
// } from "@/app/(dashboard)/attendance/actions";

// Temporary type definition
type AttendanceEntryInput = {
  studentId: string;
  status: string;
  comments?: string | null;
};

// Temporary stub functions - to be replaced with API calls
const supabase = createSupabaseBrowserClient();
const addStudent = async (params: any): Promise<{ success?: string; error?: string }> => ({ success: "Stub - to be implemented" });
const addStudentsFromCsv = async (params: any): Promise<{ success?: string; error?: string }> => ({ success: "Stub - to be implemented" });

// Real implementation: Call Python API
const saveAttendance = async (params: {
  sectionId: string;
  attendanceDate: string;
  schoolYear: string;
  entries: AttendanceEntryInput[];
}): Promise<{ success?: string; error?: string }> => {
  try {
    // Get JWT token from Supabase session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return { error: "Not authenticated. Please sign in again." };
    }

    // Call Python API
    const response = await fetch("/api/attendance", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sectionId: params.sectionId,
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
import { AttendanceStatistics } from "./AttendanceStatistics";

type Student = {
  id: string;
  student_identifier?: number | null;
  full_name: string;
};

type ExistingAttendance = Record<
  string,
  { status: AttendanceStatus; comments?: string | null }
>;

// Status options for attendance (currently unused but kept for future use)
// const statusOptions: { value: AttendanceStatus; label: string }[] = [
//   { value: "present", label: "Present" },
//   { value: "absent", label: "Absent" },
//   { value: "late", label: "Late" },
//   { value: "left_early", label: "Left Early" },
// ];

export function AttendanceEditor({
  sectionId,
  schoolYear,
  attendanceDate,
  students,
  existing,
  locked,
  holidayName,
}: {
  sectionId: string;
  schoolYear: string;
  attendanceDate: string;
  students: Student[];
  existing: ExistingAttendance;
  locked: boolean;
  holidayName?: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [csvPending, startCsvTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [studentIdentifier, setStudentIdentifier] = useState("");
  const [studentName, setStudentName] = useState("");
  const [showCommentInputs, setShowCommentInputs] = useState<Record<string, boolean>>({});

  const initialEntries = useMemo(() => {
    return students.map((student) => ({
      studentId: student.id,
      status: existing[student.id]?.status ?? "present",
      comments: existing[student.id]?.comments ?? "",
    }));
  }, [students, existing]);

  const [entries, setEntries] = useState<AttendanceEntryInput[]>(initialEntries);

  useEffect(() => {
    setEntries(initialEntries);
  }, [initialEntries]);

  const updateEntry = (
    studentId: string,
    patch: Partial<AttendanceEntryInput>
  ) => {
    setEntries((current) =>
      current.map((entry) =>
        entry.studentId === studentId ? { ...entry, ...patch } : entry
      )
    );
  };

  // Calculate statistics from entries
  const statistics = useMemo(() => {
    const counts = {
      present: 0,
      absent: 0,
      late: 0,
      left_early: 0,
    };
    entries.forEach((entry) => {
      if (entry.status in counts) {
        counts[entry.status as keyof typeof counts]++;
      }
    });
    return counts;
  }, [entries]);

  const handleSave = () => {
    // COMMENTED OUT FOR TESTING - Daily cutoff check
    // if (locked) {
    //   toast.error("Attendance is locked after 3:00 PM PT.");
    //   return;
    // }
    startTransition(() => {
      saveAttendance({
        sectionId,
        attendanceDate,
        schoolYear,
        entries,
      }).then((result) => {
        if (result?.error) {
          toast.error(result.error);
        } else {
          toast.success(result?.success ?? "Attendance saved.");
        }
      });
    });
  };

  const handleManualAdd = () => {
    if (!studentIdentifier.trim() || !studentName.trim()) {
      toast.error("Enter a student ID and name.");
      return;
    }
    startTransition(() => {
      addStudent({
        sectionId,
        schoolYear,
        studentIdentifier: studentIdentifier.trim(),
        fullName: studentName.trim(),
      }).then((result) => {
        if (result?.error) {
          toast.error(result.error);
        } else {
          toast.success(result?.success ?? "Student added.");
          setStudentIdentifier("");
          setStudentName("");
          setDialogOpen(false);
        }
      });
    });
  };


  const handleCsvUpload = (file: File) => {
    startCsvTransition(() => {
      Papa.parse<string[]>(file, {
        skipEmptyLines: true,
        complete: async (results) => {
          const students = results.data
            .map((row, index) => {
              const id = String(row[0] ?? "").trim();
              const name = String(row[1] ?? "").trim();
              if (
                index === 0 &&
                id.toLowerCase().includes("id") &&
                name.toLowerCase().includes("name")
              ) {
                return null;
              }
              return { studentIdentifier: id, fullName: name };
            })
            .filter((row): row is { studentIdentifier: string; fullName: string } =>
              Boolean(row && row.studentIdentifier && row.fullName)
            );
          const result = await addStudentsFromCsv({
            sectionId,
            schoolYear,
            students,
          });
          if (result?.error) {
            toast.error(result.error);
          } else {
            toast.success(result?.success ?? "Roster uploaded.");
          }
        },
        error: () => {
          toast.error("Unable to parse CSV.");
        },
      });
    });
  };

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <AttendanceStatistics counts={statistics} />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            Attendance date: {attendanceDate}
          </p>
        {holidayName ? (
          <p className="text-sm text-emerald-600">
            Holiday: {holidayName}. Attendance is not required today.
          </p>
        ) : null}
        {/* COMMENTED OUT FOR TESTING - Daily cutoff lock message */}
        {/* locked ? (
          <p className="text-sm text-destructive">
            Attendance is locked after 11:00 PM PT.
          </p>
        ) : null */}
        </div>
        <Button onClick={handleSave} disabled={locked || isPending}>
          {isPending ? "Saving..." : "Save attendance"}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline">
              Add student
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add student</DialogTitle>
              <DialogDescription>
                Enter the student ID and student name.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Student ID</label>
                <Input
                  value={studentIdentifier}
                  onChange={(event) => setStudentIdentifier(event.target.value)}
                  placeholder="STU-001"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Student name</label>
                <Input
                  value={studentName}
                  onChange={(event) => setStudentName(event.target.value)}
                  placeholder="Student Name"
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleManualAdd} disabled={isPending}>
                  {isPending ? "Adding..." : "Add student"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            CSV columns: Student ID, Student Name
          </p>
          <Input
            type="file"
            accept=".csv"
            disabled={csvPending}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                handleCsvUpload(file);
              }
            }}
          />
        </div>
      </div>

      <div className="hidden md:block">
        <div className="space-y-3">
          {students.map((student) => {
            const entry = entries.find((item) => item.studentId === student.id);
            const currentStatus = entry?.status ?? "present";
            const showCommentInput = showCommentInputs[student.id] ?? false;
            
            return (
              <div
                key={student.id}
                className={`rounded-[12px] border bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.08)] ${
                  currentStatus === "absent" ? "border-[#8b5cf6]" : "border-[#e5e7eb]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-[#0f172a] text-base">
                      {student.full_name}
                    </p>
                    <p className="text-xs text-[#64748b] mt-0.5">
                      ID: {student.student_identifier ?? "-"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Present Button */}
                    <Tooltip content="Present" side="bottom">
                      <button
                        type="button"
                        onClick={() =>
                          !locked && updateEntry(student.id, { status: "present" })
                        }
                        disabled={locked}
                        className={`w-10 h-10 rounded-[8px] flex items-center justify-center transition-all ${
                          currentStatus === "present"
                            ? "bg-[#10b981] text-white"
                            : "bg-white border border-[#e5e7eb] text-[#9ca3af] hover:border-[#d1d5db]"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <Check className="w-5 h-5" />
                      </button>
                    </Tooltip>

                    {/* Absent Button */}
                    <Tooltip content="Absent" side="bottom">
                      <button
                        type="button"
                        onClick={() =>
                          !locked && updateEntry(student.id, { status: "absent" })
                        }
                        disabled={locked}
                        className={`w-10 h-10 rounded-[8px] flex items-center justify-center transition-all ${
                          currentStatus === "absent"
                            ? "bg-white border-2 border-[#ef4444] text-[#ef4444]"
                            : "bg-white border border-[#e5e7eb] text-[#9ca3af] hover:border-[#d1d5db]"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </Tooltip>

                    {/* Late Button */}
                    <Tooltip content="Late" side="bottom">
                      <button
                        type="button"
                        onClick={() =>
                          !locked && updateEntry(student.id, { status: "late" })
                        }
                        disabled={locked}
                        className={`w-10 h-10 rounded-[8px] flex items-center justify-center transition-all ${
                          currentStatus === "late"
                            ? "bg-white border-2 border-[#f97316] text-[#f97316]"
                            : "bg-white border border-[#e5e7eb] text-[#9ca3af] hover:border-[#d1d5db]"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <Clock className="w-5 h-5" />
                      </button>
                    </Tooltip>

                    {/* Left Early Button */}
                    <Tooltip content="Left Early" side="bottom">
                      <button
                        type="button"
                        onClick={() =>
                          !locked && updateEntry(student.id, { status: "left_early" })
                        }
                        disabled={locked}
                        className={`w-10 h-10 rounded-[8px] flex items-center justify-center transition-all ${
                          currentStatus === "left_early"
                            ? "bg-white border-2 border-[#8b5cf6] text-[#8b5cf6]"
                            : "bg-white border border-[#e5e7eb] text-[#9ca3af] hover:border-[#d1d5db]"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <ArrowRight className="w-5 h-5" />
                      </button>
                    </Tooltip>

                    {/* Comment Button */}
                    <Tooltip content="Add Comment" side="bottom">
                      <button
                        type="button"
                        onClick={() =>
                          setShowCommentInputs((prev) => ({
                            ...prev,
                            [student.id]: !prev[student.id],
                          }))
                        }
                        className="w-10 h-10 rounded-[8px] flex items-center justify-center bg-white border border-[#e5e7eb] text-[#9ca3af] hover:border-[#d1d5db] transition-all"
                      >
                        <Pencil className="w-5 h-5" />
                      </button>
                    </Tooltip>
                  </div>
                </div>
                {showCommentInput && (
                  <div className="mt-3">
                    <Input
                      value={entry?.comments ?? ""}
                      onChange={(event) =>
                        updateEntry(student.id, { comments: event.target.value })
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

      <div className="space-y-3 md:hidden">
        {students.map((student) => {
          const entry = entries.find((item) => item.studentId === student.id);
          const currentStatus = entry?.status ?? "present";
          const showCommentInput = showCommentInputs[student.id] ?? false;
          
          return (
            <div
              key={student.id}
              className={`rounded-[12px] border bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.08)] ${
                currentStatus === "absent" ? "border-[#8b5cf6]" : "border-[#e5e7eb]"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex-1">
                  <p className="font-semibold text-[#0f172a] text-base">
                    {student.full_name}
                  </p>
                  <p className="text-xs text-[#64748b] mt-0.5">
                    ID: {student.student_identifier ?? "-"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Present Button */}
                <Tooltip content="Present" side="bottom">
                  <button
                    type="button"
                    onClick={() =>
                      !locked && updateEntry(student.id, { status: "present" })
                    }
                    disabled={locked}
                    className={`w-10 h-10 rounded-[8px] flex items-center justify-center transition-all ${
                      currentStatus === "present"
                        ? "bg-[#10b981] text-white"
                        : "bg-white border border-[#e5e7eb] text-[#9ca3af] hover:border-[#d1d5db]"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <Check className="w-5 h-5" />
                  </button>
                </Tooltip>

                {/* Absent Button */}
                <Tooltip content="Absent" side="bottom">
                  <button
                    type="button"
                    onClick={() =>
                      !locked && updateEntry(student.id, { status: "absent" })
                    }
                    disabled={locked}
                    className={`w-10 h-10 rounded-[8px] flex items-center justify-center transition-all ${
                      currentStatus === "absent"
                        ? "bg-white border-2 border-[#ef4444] text-[#ef4444]"
                        : "bg-white border border-[#e5e7eb] text-[#9ca3af] hover:border-[#d1d5db]"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </Tooltip>

                {/* Late Button */}
                <Tooltip content="Late" side="bottom">
                  <button
                    type="button"
                    onClick={() =>
                      !locked && updateEntry(student.id, { status: "late" })
                    }
                    disabled={locked}
                    className={`w-10 h-10 rounded-[8px] flex items-center justify-center transition-all ${
                      currentStatus === "late"
                        ? "bg-white border-2 border-[#f97316] text-[#f97316]"
                        : "bg-white border border-[#e5e7eb] text-[#9ca3af] hover:border-[#d1d5db]"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <Clock className="w-5 h-5" />
                  </button>
                </Tooltip>

                {/* Left Early Button */}
                <Tooltip content="Left Early" side="bottom">
                  <button
                    type="button"
                    onClick={() =>
                      !locked && updateEntry(student.id, { status: "left_early" })
                    }
                    disabled={locked}
                    className={`w-10 h-10 rounded-[8px] flex items-center justify-center transition-all ${
                      currentStatus === "left_early"
                        ? "bg-white border-2 border-[#8b5cf6] text-[#8b5cf6]"
                        : "bg-white border border-[#e5e7eb] text-[#9ca3af] hover:border-[#d1d5db]"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </Tooltip>

                {/* Comment Button */}
                <Tooltip content="Add Comment" side="bottom">
                  <button
                    type="button"
                    onClick={() =>
                      setShowCommentInputs((prev) => ({
                        ...prev,
                        [student.id]: !prev[student.id],
                      }))
                    }
                    className="w-10 h-10 rounded-[8px] flex items-center justify-center bg-white border border-[#e5e7eb] text-[#9ca3af] hover:border-[#d1d5db] transition-all"
                  >
                    <Pencil className="w-5 h-5" />
                  </button>
                </Tooltip>
              </div>
              {showCommentInput && (
                <div className="mt-3">
                  <Input
                    value={entry?.comments ?? ""}
                    onChange={(event) =>
                      updateEntry(student.id, { comments: event.target.value })
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

