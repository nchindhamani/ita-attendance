"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Papa from "papaparse";
import { toast } from "sonner";

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AttendanceStatus } from "@/lib/types";
import {
  addStudent,
  addStudentsFromCsv,
  saveAttendance,
  type AttendanceEntryInput,
} from "@/app/(dashboard)/attendance/actions";

type Student = {
  id: string;
  student_identifier?: number | null;
  full_name: string;
};

type ExistingAttendance = Record<
  string,
  { status: AttendanceStatus; comments?: string | null }
>;

const statusOptions: { value: AttendanceStatus; label: string }[] = [
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "late", label: "Late" },
  { value: "left_early", label: "Left Early" },
];

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

  const handleSave = () => {
    if (locked) {
      toast.error("Attendance is locked after 3:00 PM PT.");
      return;
    }
    startTransition(async () => {
      const result = await saveAttendance({
        sectionId,
        attendanceDate,
        schoolYear,
        entries,
      });
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(result?.success ?? "Attendance saved.");
      }
    });
  };

  const handleManualAdd = () => {
    if (!studentIdentifier.trim() || !studentName.trim()) {
      toast.error("Enter a student ID and name.");
      return;
    }
    startTransition(async () => {
      const result = await addStudent({
        sectionId,
        schoolYear,
        studentIdentifier: studentIdentifier.trim(),
        fullName: studentName.trim(),
      });
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(result?.success ?? "Student added.");
        setStudentIdentifier("");
        setStudentName("");
        setDialogOpen(false);
      }
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            Attendance date: {attendanceDate}
          </p>
        {holidayName ? (
          <p className="text-sm text-emerald-600">
            Holiday: {holidayName}. Attendance is not required today.
          </p>
        ) : locked ? (
          <p className="text-sm text-destructive">
            Attendance is locked after 3:00 PM PT.
          </p>
        ) : null}
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Comments</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((student) => {
              const entry = entries.find((item) => item.studentId === student.id);
              return (
                <TableRow key={student.id}>
                  <TableCell className="font-medium">
                    {student.full_name}
                  </TableCell>
                  <TableCell>
                    <select
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                      value={entry?.status ?? "present"}
                      onChange={(event) =>
                        updateEntry(student.id, {
                          status: event.target.value as AttendanceStatus,
                        })
                      }
                      disabled={locked}
                    >
                      {statusOptions.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>
                    <Input
                      value={entry?.comments ?? ""}
                      onChange={(event) =>
                        updateEntry(student.id, { comments: event.target.value })
                      }
                      disabled={locked}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 md:hidden">
        {students.map((student) => {
          const entry = entries.find((item) => item.studentId === student.id);
          return (
            <div
              key={student.id}
              className="rounded-lg border border-border bg-background p-4"
            >
              <p className="font-medium">{student.full_name}</p>
              <div className="mt-3 space-y-2">
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={entry?.status ?? "present"}
                  onChange={(event) =>
                    updateEntry(student.id, {
                      status: event.target.value as AttendanceStatus,
                    })
                  }
                  disabled={locked}
                >
                  {statusOptions.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
                <Input
                  value={entry?.comments ?? ""}
                  onChange={(event) =>
                    updateEntry(student.id, { comments: event.target.value })
                  }
                  disabled={locked}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

