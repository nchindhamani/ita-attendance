import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RealtimeRefresh } from "@/features/admin/RealtimeRefresh";
import { UserRowActions } from "@/features/admin/UserRowActions";

type SearchParams = {
  status?: string;
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole("admin");
  const supabase = createSupabaseServerClient();

  const status = searchParams.status ?? "pending";
  let query = supabase
    .from("profiles")
    .select("id,full_name,email,is_active,is_approved,created_at")
    .eq("role", "teacher")
    .order("created_at", { ascending: false });

  if (status === "active") {
    query = query.eq("is_active", true);
  } else if (status === "inactive") {
    query = query.eq("is_active", false);
  } else if (status === "pending") {
    query = query.eq("is_approved", false);
  }

  const { data: teachers } = await query;

  return (
    <div className="space-y-6">
      <RealtimeRefresh table="profiles" />
      <div>
        <h2 className="text-2xl font-semibold">User Management</h2>
        <p className="text-sm text-muted-foreground">
          Approve new teachers and manage active access.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { label: "Pending", value: "pending" },
          { label: "Active", value: "active" },
          { label: "Inactive", value: "inactive" },
          { label: "All", value: "all" },
        ].map((item) => (
          <Button
            key={item.value}
            variant={status === item.value ? "default" : "outline"}
            size="sm"
            asChild
          >
            <Link href={`/admin/users?status=${item.value}`}>{item.label}</Link>
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Teachers</CardTitle>
        </CardHeader>
        <CardContent>
          {teachers && teachers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teachers.map((teacher) => (
                  <TableRow key={teacher.id}>
                    <TableCell>{teacher.full_name ?? "Unknown"}</TableCell>
                    <TableCell>{teacher.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant={teacher.is_active ? "secondary" : "muted"}
                      >
                        {teacher.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <UserRowActions
                        profileId={teacher.id}
                        isApproved={teacher.is_approved}
                        isActive={teacher.is_active}
                        displayName={teacher.full_name ?? teacher.email ?? "Teacher"}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              All caught up! No teachers match this filter.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

