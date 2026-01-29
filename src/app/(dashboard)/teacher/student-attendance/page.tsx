import { requireActiveProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
};

export default async function TeacherStudentAttendancePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await requireActiveProfile();
  const supabase = createSupabaseServerClient();
  const studentIdInput = searchParams.studentId?.trim() ?? "";

  const { data: settings } = await supabase
    .from("system_settings")
    .select("current_school_year")
    .eq("id", 1)
    .single();

  const schoolYear = settings?.current_school_year ?? "2025-2026";

  const { data: assignments } = await supabase
    .from("teacher_sections")
    .select("grade,section,school_year")
    .eq("teacher_id", profile.id)
    .eq("school_year", schoolYear);

  const allowed = new Set(
    (assignments ?? []).map(
      (item) => `${item.grade ?? ""}-${item.section ?? ""}`
    )
  );

  let student: {
    id: string;
    full_name: string;
    student_identifier: number | null;
    grade: string | null;
    section: string | null;
    school_year: string;
  } | null = null;
  let attendance: { attendance_date: string; status: string; comments: string | null }[] =
    [];
  let errorMessage: string | null = null;

  if (studentIdInput) {
    const studentIdentifier = Number(studentIdInput);
    if (!Number.isInteger(studentIdentifier)) {
      errorMessage = "Student ID must be a number.";
    } else {
      const { data: foundStudent } = await supabase
        .from("students")
        .select(
          "id,full_name,student_identifier,grade,section,school_year"
        )
        .eq("student_identifier", studentIdentifier)
        .eq("school_year", schoolYear)
        .maybeSingle();

      if (!foundStudent) {
        errorMessage = "No student found for the current school year.";
      } else if (
        !allowed.has(`${foundStudent.grade ?? ""}-${foundStudent.section ?? ""}`)
      ) {
        errorMessage = "You are not assigned to this student's class.";
      } else {
        student = foundStudent;
        const { data: rows } = await supabase
          .from("attendance")
          .select("attendance_date,status,comments")
          .eq("student_id", foundStudent.id)
          .eq("school_year", schoolYear)
          .order("attendance_date", { ascending: false });
        attendance = rows ?? [];
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Student Attendance Lookup</h2>
        <p className="text-sm text-muted-foreground">
          Search by ITA Student ID for the current school year ({schoolYear}).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search by Student ID</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap items-center gap-3">
            <Input
              name="studentId"
              placeholder="Enter ITA student ID"
              defaultValue={studentIdInput}
            />
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

