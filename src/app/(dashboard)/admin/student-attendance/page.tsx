import { requireRole } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  let sectionInfo: { grade: string; section: string } | null = null;
  let teacherName: string | null = null;
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

          // Fetch section information for the selected school year
          if (studentData.section_id) {
            const { data: section } = await admin
              .from("sections")
              .select("grade,section,school_year")
              .eq("id", studentData.section_id)
              .eq("school_year", selectedYear)
              .maybeSingle();
            
            if (section) {
              const sectionData = Array.isArray(section) ? section[0] : section;
              if (sectionData && 'grade' in sectionData && 'section' in sectionData) {
                sectionInfo = {
                  grade: sectionData.grade,
                  section: sectionData.section,
                };
              }
            }

            // Fetch teacher information for this section in the selected school year
            // First verify the section exists for this school year, then get teacher
            if (sectionInfo) {
              const { data: teacherSection } = await admin
                .from("teacher_sections")
                .select("teacher_id")
                .eq("section_id", studentData.section_id)
                .limit(1)
                .maybeSingle();
              
              if (teacherSection && teacherSection.teacher_id) {
                const { data: teacher } = await admin
                  .from("profiles")
                  .select("full_name")
                  .eq("id", teacherSection.teacher_id)
                  .maybeSingle();
                
                if (teacher) {
                  const teacherData = Array.isArray(teacher) ? teacher[0] : teacher;
                  if (teacherData && 'full_name' in teacherData) {
                    teacherName = teacherData.full_name;
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[2.5rem] font-heading font-bold text-[#0f172a] leading-tight mb-3">Student Attendance Lookup</h2>
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
        <div className="space-y-6">
          <div className="bg-white rounded-[16px] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
            <h3 className="text-[1.75rem] font-heading font-bold text-[#0f172a] leading-tight mb-4">
              {student.full_name}
            </h3>
            <div className="space-y-2">
              <p className="text-sm text-[#64748b]">ID: {student.student_identifier ?? "-"}</p>
              {sectionInfo && (
                <p className="text-sm text-[#64748b]">Class: Grade {sectionInfo.grade} - {sectionInfo.section}</p>
              )}
              {teacherName && (
                <p className="text-sm text-[#64748b]">Teacher: {teacherName}</p>
              )}
            </div>
          </div>
          
          {attendance.length > 0 ? (
            <div className="space-y-4">
              <h4 className="text-xl font-heading font-semibold text-[#0f172a]">
                Attendance History
              </h4>
              <div className="space-y-3">
                {attendance.map((row) => {
                  const statusColors = {
                    present: "bg-[#d1fae5] text-[#065f46]",
                    absent: "bg-[#fee2e2] text-[#991b1b]",
                    late: "bg-[#fed7aa] text-[#9a3412]",
                    left_early: "bg-[#e9d5ff] text-[#6b21a8]",
                  };
                  const statusColor = statusColors[row.status as keyof typeof statusColors] || "bg-gray-100 text-gray-700";
                  
                  return (
                    <div
                      key={row.attendance_date}
                      className="bg-[#f8f9fa] rounded-[12px] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.1)]"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-base font-medium text-[#0f172a] w-32 flex-shrink-0">
                          {row.attendance_date}
                        </span>
                        <span
                          className={`px-3 py-1 rounded-[8px] text-sm font-medium capitalize whitespace-nowrap ${statusColor}`}
                        >
                          {row.status}
                        </span>
                        {row.comments && (
                          <span className="text-sm text-[#64748b]">
                            {row.comments}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No attendance recorded for this student yet.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

