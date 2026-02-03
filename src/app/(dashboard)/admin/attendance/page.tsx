import { requireRole } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatPacificDate } from "@/lib/time";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HistoryTable } from "@/features/history/HistoryTable";
import { AttendanceStatistics } from "@/features/attendance/AttendanceStatistics";

type SearchParams = {
  section?: string;
  date?: string;
};

export default async function AdminAttendancePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole("admin");
  const supabase = createSupabaseAdminClient();
  const selectedDate = searchParams.date ?? formatPacificDate(new Date());

  const { data: sections } = await supabase
    .from("sections")
    .select("id,grade,section")
    .order("grade", { ascending: true });

  const sectionId = searchParams.section ?? sections?.[0]?.id;

  const { data: attendance } =
    sectionId
      ? await supabase
          .from("attendance")
          .select("status,comments,students!inner(full_name,student_identifier)")
          .eq("attendance_date", selectedDate)
          .eq("section_id", sectionId)
      : { data: [] };

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

  const selectedSection = sections?.find((item) => item.id === sectionId);

  // Calculate statistics from attendance data
  const statistics = {
    present: attendance?.filter((entry) => entry.status === "present").length ?? 0,
    absent: attendance?.filter((entry) => entry.status === "absent").length ?? 0,
    late: attendance?.filter((entry) => entry.status === "late").length ?? 0,
    left_early: attendance?.filter((entry) => entry.status === "left_early").length ?? 0,
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Attendance Reports</h2>
        <p className="text-sm text-muted-foreground">
          View attendance by class and export CSVs.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap items-center gap-3">
            <select
              name="section"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              defaultValue={sectionId}
            >
              {sections?.map((section) => (
                <option key={section.id} value={section.id}>
                  Grade {section.grade} - {section.section}
                </option>
              ))}
            </select>
            <input
              type="date"
              name="date"
              defaultValue={selectedDate}
              max={formatPacificDate(new Date())}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            />
            <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
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
        filename={`attendance-${selectedSection?.grade ?? ""}-${selectedSection?.section ?? ""}-${selectedDate}.csv`}
      />
    </div>
  );
}

