import { redirect } from "next/navigation";
import { requireActiveProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatPacificDate } from "@/lib/time";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { HistoryTable } from "@/features/history/HistoryTable";
import { AttendanceStatistics } from "@/features/attendance/AttendanceStatistics";

type SearchParams = {
  section?: string;
  date?: string;
};

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await requireActiveProfile();
  const sectionId = searchParams.section;
  const selectedDate = searchParams.date ?? formatPacificDate(new Date());

  const supabase = createSupabaseServerClient();
  if (!sectionId && profile.role === "teacher") {
    const { data: assignments } = await supabase
      .from("teacher_sections")
      .select("section_id")
      .eq("teacher_id", profile.id)
      .limit(1);
    const assignedSectionId = assignments?.[0]?.section_id;
    if (assignedSectionId) {
      redirect(`/history?section=${assignedSectionId}&date=${selectedDate}`);
    }
  }

  if (!sectionId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Select a section</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Choose a section from your dashboard to view attendance history.
        </CardContent>
      </Card>
    );
  }
  const { data: sectionData } = await supabase
    .from("sections")
    .select("grade,section")
    .eq("id", sectionId)
    .maybeSingle();

  // Type guard: ensure sectionData is an object, not an array
  const section = Array.isArray(sectionData) ? sectionData[0] : sectionData;

  const { data: attendance } = await supabase
    .from("attendance")
    .select("status,comments,students!inner(full_name,student_identifier)")
    .eq("attendance_date", selectedDate)
    .eq("section_id", sectionId);

  const rows =
    attendance?.map((entry) => {
      const student = Array.isArray(entry.students)
        ? entry.students[0]
        : entry.students;
      return {
        student_name: student?.full_name ?? "Unknown",
        student_identifier: student?.student_identifier ?? null,
        status: entry.status,
        comments: entry.comments ?? null,
      };
    }) ?? [];

  // Calculate statistics from attendance data
  const statistics = {
    present: attendance?.filter((entry) => entry.status === "present").length ?? 0,
    absent: attendance?.filter((entry) => entry.status === "absent").length ?? 0,
    late: attendance?.filter((entry) => entry.status === "late").length ?? 0,
    left_early: attendance?.filter((entry) => entry.status === "left_early").length ?? 0,
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-[2.5rem] font-heading font-bold text-[#0f172a] leading-tight mb-3">
          History - Grade {section?.grade} {section?.section}
        </h2>
        <p className="text-lg text-[#64748b] font-normal leading-relaxed">
          Review or download attendance from a prior date.
        </p>
      </div>

      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-lg">Pick a date</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <form className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1 sm:max-w-[180px]">
              <Input
                type="date"
                name="date"
                defaultValue={selectedDate}
                max={formatPacificDate(new Date())}
                className="w-full"
              />
            </div>
            <input type="hidden" name="section" value={sectionId} />
            <button
              type="submit"
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground sm:w-auto"
            >
              View
            </button>
          </form>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      {attendance && attendance.length > 0 && (
        <AttendanceStatistics counts={statistics} />
      )}

      <HistoryTable
        rows={rows}
        filename={`attendance-${section?.grade ?? ""}-${section?.section ?? ""}-${selectedDate}.csv`}
      />
    </div>
  );
}

