import { requireActiveProfile } from "@/lib/auth";
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
};

export default async function TeacherStudentAttendancePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await requireActiveProfile();
  const admin = createSupabaseAdminClient();
  const studentIdInput = searchParams.studentId?.trim() ?? "";

  const { data: settings } = await admin
    .from("system_settings")
    .select("current_school_year")
    .eq("id", 1)
    .single();

  const schoolYear = settings?.current_school_year ?? "2025-2026";

  const { data: assignments } = await admin
    .from("teacher_sections")
    .select("section:sections(id,school_year)")
    .eq("teacher_id", profile.id)
    .eq("sections.school_year", schoolYear);

  const allowedSectionIds = new Set(
    (assignments ?? [])
      .map((item) => item.section?.id)
      .filter(Boolean) as string[]
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
    if (allowedSectionIds.size === 0) {
      errorMessage = "No class is assigned to your account yet.";
    } else {
      const { data: foundStudent } = await admin
        .from("students")
        .select("id,full_name,student_identifier,section_id,school_year")
        .eq("student_identifier", studentIdInput)
        .eq("school_year", schoolYear)
        .maybeSingle();

      if (!foundStudent) {
        errorMessage = "No student found for the current school year.";
      } else if (
        !foundStudent.section_id ||
        !allowedSectionIds.has(foundStudent.section_id)
      ) {
        errorMessage = "You are not assigned to this student's class.";
      } else {
        student = foundStudent;
        const { data: rows } = await admin
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

