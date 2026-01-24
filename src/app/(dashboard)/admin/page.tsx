import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function AdminOverviewPage() {
  await requireRole("admin");
  const supabase = createSupabaseServerClient();

  const [{ count: pendingCount }, { count: activeCount }] = await Promise.all([
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "teacher")
      .eq("is_approved", false),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "teacher")
      .eq("is_active", true),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Admin Overview</h2>
          <p className="text-sm text-muted-foreground">
            Approve teachers, review attendance, and manage yearly archives.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/users">Review pending teachers</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pending approvals</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {pendingCount ?? 0}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Active teachers</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {activeCount ?? 0}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

