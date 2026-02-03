import Link from "next/link";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function AdminOverviewPage() {
  await requireRole("admin");
  const supabase = createSupabaseAdminClient();

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
      .eq("is_active", true)
      .eq("is_approved", true),
  ]);

  return (
    <div className="space-y-12">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="space-y-3">
          <h2 className="text-[2.5rem] font-heading font-bold text-[#0f172a] leading-tight mb-3">Admin Overview</h2>
          <p className="text-lg text-[#64748b] font-normal leading-relaxed">
            Approve teachers, review attendance, and manage yearly archives.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/users">Review pending teachers</Link>
        </Button>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <Link href="/admin/users?tab=approval">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Pending approvals</CardTitle>
            </CardHeader>
            <CardContent className="text-[3.5rem] font-bold text-[#0f172a]">
              {pendingCount ?? 0}
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/users?tab=directory">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Active teachers</CardTitle>
            </CardHeader>
            <CardContent className="text-[3.5rem] font-bold text-[#0f172a]">
              {activeCount ?? 0}
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}

