import { requireActiveProfile } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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
  let sectionInfo: { grade: string; section: string } | null = null;
  let teacherName: string | null = null;
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

          // Fetch section information
          if (studentData.section_id) {
            const { data: section } = await admin
              .from("sections")
              .select("grade,section")
              .eq("id", studentData.section_id)
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

            // Fetch teacher information (use current teacher's name)
            teacherName = profile.full_name;
          }
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

