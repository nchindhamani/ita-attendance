import { requireRole } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type SearchParams = {
  studentId?: string;
  year?: string;
};

export default async function AdminStudentAttendancePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole("admin");
  const admin = createSupabaseAdminClient();
  const studentIdInput = searchParams.studentId?.trim() ?? "";
  const yearInput = searchParams.year?.trim() ?? "";

  let availableYears: string[] = [];
  let student:
    | {
        id: string;
        full_name: string;
        student_identifier: number | null;
        grade: string | null;
        section: string | null;
        school_year: string;
      }
    | null = null;
  let attendance: { attendance_date: string; status: string; comments: string | null }[] =
    [];
  let errorMessage: string | null = null;

  if (studentIdInput) {
    const studentIdentifier = Number(studentIdInput);
    if (!Number.isInteger(studentIdentifier)) {
      errorMessage = "Student ID must be a number.";
    } else {
      const { data: yearRows } = await admin
        .from("students")
        .select("school_year")
        .eq("student_identifier", studentIdentifier)
        .order("school_year", { ascending: false });
      availableYears = Array.from(
        new Set((yearRows ?? []).map((row) => row.school_year))
      );

      const selectedYear = yearInput || availableYears[0];
      if (!selectedYear) {
        errorMessage = "No records found for this student.";
      } else {
        const { data: foundStudent } = await admin
          .from("students")
          .select(
            "id,full_name,student_identifier,grade,section,school_year"
          )
          .eq("student_identifier", studentIdentifier)
          .eq("school_year", selectedYear)
          .maybeSingle();

        if (!foundStudent) {
          errorMessage = "No student found for the selected school year.";
        } else {
          student = foundStudent;
          const { data: rows } = await admin
            .from("attendance")
            .select("attendance_date,status,comments")
            .eq("student_id", foundStudent.id)
            .eq("school_year", selectedYear)
            .order("attendance_date", { ascending: false });
          attendance = rows ?? [];
        }
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Student Attendance Lookup</h2>
        <p className="text-sm text-muted-foreground">
          Search by ITA Student ID and pick a school year.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap items-center gap-3">
            <Input
              name="studentId"
              placeholder="Enter ITA student ID"
              defaultValue={studentIdInput}
            />
            <select
              name="year"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              defaultValue={yearInput}
              disabled={availableYears.length === 0}
            >
              <option value="">Select school year</option>
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
              Search
            </button>
          </form>
          {errorMessage ? (
            <p className="mt-3 text-sm text-destructive">{errorMessage}</p>
          ) : null}
        </CardContent>
      </Card>

      {student ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {student.full_name} (ID: {student.student_identifier})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {attendance.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Comments</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendance.map((row) => (
                    <TableRow key={row.attendance_date}>
                      <TableCell>{row.attendance_date}</TableCell>
                      <TableCell className="capitalize">{row.status}</TableCell>
                      <TableCell>{row.comments ?? "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">
                No attendance recorded for this student yet.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

