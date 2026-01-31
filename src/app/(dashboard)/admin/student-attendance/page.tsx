import { requireRole } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StudentAttendanceSearch } from "@/features/admin/StudentAttendanceSearch";

type SearchParams = {
  studentId?: string;
  year?: string;
};

interface Student {
  id: string;
  full_name: string;
  student_identifier: number | null;
  section_id: string | null;
  school_year: string;
}

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
  let student: Student | null = null;
  let attendance: { attendance_date: string; status: string; comments: string | null }[] =
    [];
  let errorMessage: string | null = null;

  // Always fetch available years from attendance table if studentId is provided
  if (studentIdInput) {
    const studentIdNum = Number(studentIdInput);
    if (Number.isInteger(studentIdNum)) {
      const { data: yearRows, error: yearError } = await admin
        .from("attendance")
        .select("school_year")
        .eq("student_identifier", studentIdNum)
        .order("school_year", { ascending: false });
      
      if (yearError) {
        errorMessage = `Error fetching years: ${yearError.message}`;
      } else {
        // Get unique years in reverse chronological order (newest first)
        const yearSet = new Set<string>();
        const orderedYears: string[] = [];
        (yearRows ?? []).forEach((row) => {
          if (row.school_year && !yearSet.has(row.school_year)) {
            yearSet.add(row.school_year);
            orderedYears.push(row.school_year);
          }
        });
        availableYears = orderedYears;
      }
    } else {
      errorMessage = "Student ID must be a valid number.";
    }
  }

  // Only fetch student and attendance if both studentId and year are provided
  if (studentIdInput && yearInput) {
    const studentIdNum = Number(studentIdInput);
    const selectedYear = yearInput;
    if (!Number.isInteger(studentIdNum)) {
      errorMessage = "Student ID must be a number.";
    } else if (!availableYears.includes(selectedYear)) {
      errorMessage = "Invalid school year selected.";
    } else {
      const { data: foundStudent } = await admin
        .from("students")
        .select("id,full_name,student_identifier,section_id,school_year")
        .eq("student_identifier", studentIdNum)
        .eq("school_year", selectedYear)
        .maybeSingle();

      if (!foundStudent) {
        errorMessage = "No student found for the selected school year.";
      } else {
        // Type guard: ensure foundStudent is an object, not an array
        const studentData = Array.isArray(foundStudent)
          ? foundStudent[0]
          : foundStudent;
        if (studentData && 'id' in studentData && 'full_name' in studentData) {
          student = studentData as Student;
          const { data: rows } = await admin
            .from("attendance")
            .select("attendance_date,status,comments")
            .eq("student_id", studentData.id)
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
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-lg">Search</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <StudentAttendanceSearch
            initialStudentId={studentIdInput}
            initialYear={yearInput}
            availableYears={availableYears}
            hasError={!!errorMessage}
          />
          {errorMessage ? (
            <p className="mt-3 text-sm text-destructive">{errorMessage}</p>
          ) : null}
          {studentIdInput && availableYears.length === 0 && !errorMessage ? (
            <p className="mt-3 text-sm text-destructive">
              No attendance records found for student ID {studentIdInput}. Please verify the student ID.
            </p>
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

