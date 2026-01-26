import { requireRole } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArchiveActions } from "@/features/archive/ArchiveActions";
import { prepareArchive } from "./actions";

export default async function ArchivePage() {
  await requireRole("admin");
  const admin = createSupabaseAdminClient();

  const { data: settings } = await admin
    .from("system_settings")
    .select("current_school_year,archive_status,archive_path")
    .eq("id", 1)
    .single();

  const downloadLinks: { label: string; url: string }[] = [];
  if (settings?.archive_status === "ARCHIVE_READY" && settings.archive_path) {
    const studentsUrl = await admin.storage
      .from("ITA_attendance_archives")
      .createSignedUrl(`${settings.archive_path}/students.csv`, 3600);
    const attendanceUrl = await admin.storage
      .from("ITA_attendance_archives")
      .createSignedUrl(`${settings.archive_path}/attendance.csv`, 3600);

    if (studentsUrl.data?.signedUrl) {
      downloadLinks.push({
        label: "Students CSV",
        url: studentsUrl.data.signedUrl,
      });
    }
    if (attendanceUrl.data?.signedUrl) {
      downloadLinks.push({
        label: "Attendance CSV",
        url: attendanceUrl.data.signedUrl,
      });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Archive & Purge</h2>
        <p className="text-sm text-muted-foreground">
          Export attendance data for the school year, verify it, then purge the
          database.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Archive status: {settings?.archive_status ?? "IDLE"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            School year: {settings?.current_school_year ?? "Not set"}
          </p>
          {settings?.archive_status === "IDLE" ? (
            <form action={prepareArchive}>
              <Button type="submit">Prepare Archive</Button>
            </form>
          ) : null}
          {settings?.archive_status ? (
            <ArchiveActions
              status={settings.archive_status}
              downloadLinks={downloadLinks}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

