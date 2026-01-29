import Link from "next/link";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
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
import { UserManagementActions } from "@/features/admin/UserManagementActions";

type SearchParams = {
  tab?: string;
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole("admin");
  const supabase = createSupabaseAdminClient();

  const [{ data: approvalQueue }, { data: staffDirectory }] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id,full_name,email,role,grade,section,is_active,is_approved,created_at"
      )
      .eq("is_approved", false)
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select(
        "id,full_name,email,role,grade,section,is_active,is_approved,created_at"
      )
      .eq("is_approved", true)
      .order("created_at", { ascending: false }),
  ]);

  const activeTab = searchParams.tab ?? "approval";

  return (
    <div className="space-y-6">
      <RealtimeRefresh table="profiles" />
      <div>
        <h2 className="text-2xl font-semibold">User Management</h2>
        <p className="text-sm text-muted-foreground">
          Review approvals, manage roles, and deactivate staff.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={activeTab === "approval" ? "default" : "outline"}
          asChild
        >
          <Link href="/admin/users?tab=approval">Approval Queue</Link>
        </Button>
        <Button
          size="sm"
          variant={activeTab === "directory" ? "default" : "outline"}
          asChild
        >
          <Link href="/admin/users?tab=directory">Staff Directory</Link>
        </Button>
      </div>

      {activeTab === "approval" ? (
        <Card>
          <CardHeader>
            <CardTitle>Approval Queue</CardTitle>
          </CardHeader>
          <CardContent>
            {approvalQueue && approvalQueue.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Section</TableHead>
                    <TableHead>Approval Status</TableHead>
                    <TableHead>Account Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvalQueue.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.full_name ?? "Unknown"}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell className="capitalize">{user.role}</TableCell>
                      <TableCell>{user.grade ?? "-"}</TableCell>
                      <TableCell>{user.section ?? "-"}</TableCell>
                      <TableCell>
                        <Badge variant="muted">Pending</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.is_active ? "secondary" : "muted"}>
                          {user.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <UserManagementActions
                          userId={user.id}
                          isApproved={user.is_approved}
                          isActive={user.is_active}
                          role={user.role}
                          view="approval"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                All caught up! No pending approvals.
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Staff Directory</CardTitle>
          </CardHeader>
          <CardContent>
            {staffDirectory && staffDirectory.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Section</TableHead>
                    <TableHead>Approval Status</TableHead>
                    <TableHead>Account Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staffDirectory.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.full_name ?? "Unknown"}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell className="capitalize">{user.role}</TableCell>
                      <TableCell>{user.grade ?? "-"}</TableCell>
                      <TableCell>{user.section ?? "-"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">Approved</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.is_active ? "secondary" : "muted"}>
                          {user.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <UserManagementActions
                          userId={user.id}
                          isApproved={user.is_approved}
                          isActive={user.is_active}
                          role={user.role}
                          view="directory"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                No approved staff yet.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

