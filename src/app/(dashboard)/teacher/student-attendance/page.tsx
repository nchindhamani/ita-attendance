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

interface Student {
  id: string;
  full_name: string;
  student_identifier: number | null;
  section_id: string | null;
  school_year: string;
}

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
      .map((item) => {
        // Type guard: ensure section is an object, not an array
        const section = Array.isArray(item.section)
          ? item.section[0]
          : item.section;
        return section?.id;
      })
      .filter(Boolean) as string[]
  );

  let student: Student | null = null;
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
      } else {
        // Type guard: ensure foundStudent is an object, not an array
        const studentData = Array.isArray(foundStudent)
          ? foundStudent[0]
          : foundStudent;
        if (!studentData || !('id' in studentData) || !('full_name' in studentData)) {
          errorMessage = "No student found for the current school year.";
        } else if (
          !studentData.section_id ||
          !allowedSectionIds.has(studentData.section_id)
        ) {
          errorMessage = "You are not assigned to this student's class.";
        } else {
          student = studentData as Student;
          const { data: rows } = await admin
            .from("attendance")
            .select("attendance_date,status,comments")
            .eq("student_id", studentData.id)
            .eq("school_year", schoolYear)
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
          Search by ITA Student ID for the current school year ({schoolYear}).
        </p>
      </div>

      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-lg">Search by Student ID</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <form className="flex items-center gap-3">
            <div className="w-auto max-w-[180px]">
              <Input
                name="studentId"
                placeholder="Enter ITA student ID"
                defaultValue={studentIdInput}
                className="w-full"
              />
            </div>
            <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
              Search
            </button>
          </form>
          {errorMessage ? (
            <p className="mt-3 text-sm text-destructive">{errorMessage}</p>
          ) : null}
        </CardContent>
      </Card>

      {student && 'full_name' in student ? (
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

