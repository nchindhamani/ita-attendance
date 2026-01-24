import Link from "next/link";
import { requireActiveProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function TeacherDashboardPage() {
  const profile = await requireActiveProfile();
  const supabase = createSupabaseServerClient();

  const { data: assignments } = await supabase
    .from("teacher_sections")
    .select("id,section:sections(id,grade,section,school_year)")
    .eq("teacher_id", profile.id);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">My Classes</h2>
        <p className="text-sm text-muted-foreground">
          Manage students and take attendance for each assigned section.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {assignments?.map((assignment) => (
          <Card key={assignment.id}>
            <CardHeader>
              <CardTitle>
                Grade {assignment.section?.grade} - {assignment.section?.section}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>School year: {assignment.section?.school_year}</p>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <Link
                    href={`/attendance?section=${assignment.section?.id ?? ""}`}
                  >
                    Take attendance
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/history?section=${assignment.section?.id ?? ""}`}>
                    View history
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {!assignments || assignments.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No sections assigned yet. Please contact an admin.
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

