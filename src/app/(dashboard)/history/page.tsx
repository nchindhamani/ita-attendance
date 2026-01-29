import { redirect } from "next/navigation";
import { requireActiveProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatPacificDate } from "@/lib/time";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { HistoryTable } from "@/features/history/HistoryTable";

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
  const { data: section } = await supabase
    .from("sections")
    .select("grade,section")
    .eq("id", sectionId)
    .maybeSingle();

  const { data: attendance } = await supabase
    .from("attendance")
    .select("status,comments,students!inner(full_name)")
    .eq("attendance_date", selectedDate)
    .eq("section_id", sectionId);

  const rows =
    attendance?.map((entry) => ({
      student_name: entry.students?.full_name ?? "Unknown",
      status: entry.status,
      comments: entry.comments ?? null,
    })) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">
          History - Grade {section?.grade} {section?.section}
        </h2>
        <p className="text-sm text-muted-foreground">
          Review or download attendance from a prior date.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pick a date</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap items-center gap-3">
            <Input
              type="date"
              name="date"
              defaultValue={selectedDate}
              max={formatPacificDate(new Date())}
            />
            <input type="hidden" name="section" value={sectionId} />
            <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
              View
            </button>
          </form>
        </CardContent>
      </Card>

      <HistoryTable
        rows={rows}
        filename={`attendance-${section?.grade ?? ""}-${section?.section ?? ""}-${selectedDate}.csv`}
      />
    </div>
  );
}

