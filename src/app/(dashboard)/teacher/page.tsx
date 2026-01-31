import Link from "next/link";
import { requireActiveProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Section {
  id: string;
  grade: string | null;
  section: string | null;
  room_number: string | null;
  school_year: string;
}

interface Assignment {
  id: string;
  section: Section | Section[] | null;
}

export default async function TeacherDashboardPage() {
  const profile = await requireActiveProfile();
  const supabase = createSupabaseServerClient();

  const { data: assignments } = await supabase
    .from("teacher_sections")
    .select("id,section:sections(id,grade,section,room_number,school_year)")
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
        {(assignments as Assignment[] | null)?.map((assignment) => {
          // Type guard: ensure section is an object, not an array
          const section = Array.isArray(assignment.section)
            ? assignment.section[0]
            : assignment.section;
          
          if (!section || !('grade' in section)) {
            return null;
          }

          return (
            <Card key={assignment.id}>
              <CardHeader>
                <CardTitle>
                  Grade {section.grade} - {section.section}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>School year: {section.school_year}</p>
                {section.room_number ? (
                  <p>Room: {section.room_number}</p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <Link href={`/attendance?section=${section.id ?? ""}`}>
                      Take attendance
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/history?section=${section.id ?? ""}`}>
                      View history
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
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

