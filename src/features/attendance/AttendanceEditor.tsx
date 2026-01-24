"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Papa from "papaparse";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
}: {
  sectionId: string;
  schoolYear: string;
  attendanceDate: string;
  students: Student[];
  existing: ExistingAttendance;
  locked: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [csvPending, startCsvTransition] = useTransition();
  const [manualName, setManualName] = useState("");

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
    if (!manualName.trim()) {
      toast.error("Enter a student name.");
      return;
    }
    startTransition(async () => {
      const result = await addStudent({
        sectionId,
        schoolYear,
        fullName: manualName.trim(),
      });
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(result?.success ?? "Student added.");
        setManualName("");
      }
    });
  };

  const handleCsvUpload = (file: File) => {
    startCsvTransition(() => {
      Papa.parse<string[]>(file, {
        skipEmptyLines: true,
        complete: async (results) => {
          const names = results.data.map((row) => String(row[0] ?? ""));
          const result = await addStudentsFromCsv({
            sectionId,
            schoolYear,
            names,
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
          {locked ? (
            <p className="text-sm text-destructive">
              Attendance is locked after 3:00 PM PT.
            </p>
          ) : null}
        </div>
        <Button onClick={handleSave} disabled={locked || isPending}>
          {isPending ? "Saving..." : "Save attendance"}
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-2 md:flex-row">
          <Input
            value={manualName}
            onChange={(event) => setManualName(event.target.value)}
            placeholder="Add student name"
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleManualAdd}
            disabled={isPending}
          >
            Add student
          </Button>
        </div>
        <div className="flex items-center gap-3">
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

