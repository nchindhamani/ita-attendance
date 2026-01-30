import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function AdminUserProfilePage({
  params,
}: {
  params: { id: string };
}) {
  await requireRole("admin");
  const admin = createSupabaseAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select(
      "id,full_name,email,mobile,role,grade,section,room_number,is_active,is_approved,created_at"
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!profile) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">User Profile</h2>
          <p className="text-sm text-muted-foreground">
            View full details for the selected staff member.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/users?tab=directory">Back to staff directory</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{profile.full_name ?? "Unknown"}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
          <div>
            <p className="font-medium text-foreground">Email</p>
            <p>{profile.email ?? "-"}</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Mobile</p>
            <p>{profile.mobile ?? "-"}</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Role</p>
            <p className="capitalize">{profile.role}</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Account status</p>
            <p>{profile.is_active ? "Active" : "Inactive"}</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Approval status</p>
            <p>{profile.is_approved ? "Approved" : "Pending"}</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Grade / Section</p>
            <p>
              {profile.grade ?? "-"} / {profile.section ?? "-"}
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">Room number</p>
            <p>{profile.room_number ?? "-"}</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Created</p>
            <p>
              {profile.created_at
                ? new Date(profile.created_at).toLocaleString()
                : "-"}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

