import { redirect } from "next/navigation";
import { requireActiveProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatPacificDate, isAfterDailyCutoff } from "@/lib/time";
import type { AttendanceStatus } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AttendanceEditor } from "@/features/attendance/AttendanceEditor";

type SearchParams = {
  section?: string;
};

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await requireActiveProfile();
  const sectionId = searchParams.section;

  const supabase = createSupabaseServerClient();
  if (!sectionId && profile.role === "teacher") {
    const { data: assignments } = await supabase
      .from("teacher_sections")
      .select("section_id")
      .eq("teacher_id", profile.id)
      .limit(1);
    const assignedSectionId = assignments?.[0]?.section_id;
    if (assignedSectionId) {
      redirect(`/attendance?section=${assignedSectionId}`);
    }
  }

  if (!sectionId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Select a section</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Choose a section from your dashboard to take attendance.
        </CardContent>
      </Card>
    );
  }
  const attendanceDate = formatPacificDate(new Date());

  const { data: sectionData } = await supabase
    .from("sections")
    .select("id,grade,section,room_number,school_year")
    .eq("id", sectionId)
    .maybeSingle();

  // Type guard: ensure sectionData is an object, not an array
  const section = Array.isArray(sectionData) ? sectionData[0] : sectionData;

  const { data: holidayData } = await supabase
    .from("holidays")
    .select("holiday_date,name")
    .eq("school_year", section?.school_year ?? "")
    .eq("holiday_date", attendanceDate)
    .maybeSingle();

  // Type guard: ensure holidayData is an object, not an array
  const holiday = Array.isArray(holidayData) ? holidayData[0] : holidayData;

  const { data: students } = await supabase
    .from("students")
    .select("id,full_name,student_identifier")
    .eq("section_id", sectionId)
    .order("full_name", { ascending: true });

  const studentIds = students?.map((student) => student.id) ?? [];
  const { data: attendance } =
    studentIds.length > 0
      ? await supabase
          .from("attendance")
          .select("student_id,status,comments")
          .eq("attendance_date", attendanceDate)
          .in("student_id", studentIds)
      : { data: [] };

  const existing = (attendance ?? []).reduce(
    (acc, entry) => {
      acc[entry.student_id] = {
        status: entry.status as AttendanceStatus,
        comments: entry.comments ?? "",
      };
      return acc;
    },
    {} as Record<string, { status: AttendanceStatus; comments?: string | null }>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">
          Attendance - Grade {section?.grade} {section?.section}
        </h2>
        <p className="text-sm text-muted-foreground">
          School year: {section?.school_year}
        </p>
      </div>
      <AttendanceEditor
        sectionId={sectionId}
        schoolYear={section?.school_year ?? ""}
        attendanceDate={attendanceDate}
        students={students ?? []}
        existing={existing}
        locked={isAfterDailyCutoff(new Date()) || Boolean(holiday)}
        holidayName={holiday?.name ?? null}
      />
    </div>
  );
}

