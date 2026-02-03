import Link from "next/link";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
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
import { EmptyState } from "@/components/ui/empty-state";

type SearchParams = {
  tab?: string;
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const adminProfile = await requireRole("admin");
  const supabase = createSupabaseAdminClient();

  const [{ data: approvalQueue }, { data: staffDirectory }] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id,full_name,email,role,grade,section,mobile,is_active,is_approved,created_at"
      )
      .eq("is_approved", false)
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select(
        "id,full_name,email,role,grade,section,mobile,is_active,is_approved,created_at"
      )
      .eq("is_approved", true)
      .order("created_at", { ascending: false }),
  ]);

  const activeTab = searchParams.tab ?? "approval";

  return (
    <div className="space-y-12">
      <RealtimeRefresh table="profiles" />
      <div className="space-y-3">
        <h2 className="text-[2.5rem] font-heading font-bold text-[#0f172a] leading-tight mb-3">User Management</h2>
        <p className="text-base text-muted-foreground">
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
              <div className="overflow-x-auto">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Section</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvalQueue.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <Link
                          href={`/admin/users/${user.id}`}
                          className="font-medium text-primary underline"
                        >
                          {user.full_name ?? "Unknown"}
                        </Link>
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell className="capitalize">{user.role}</TableCell>
                      <TableCell>{user.grade ?? "-"}</TableCell>
                      <TableCell>{user.section ?? "-"}</TableCell>
                      <TableCell>
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
              </div>
            ) : (
              <EmptyState
                icon="check"
                title="All caught up!"
                description="No pending approvals at this time."
              />
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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staffDirectory.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <Link
                            href={`/admin/users/${user.id}`}
                            className="font-medium text-primary underline"
                          >
                            {user.full_name ?? "Unknown"}
                          </Link>
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell className="capitalize">{user.role}</TableCell>
                        <TableCell>{user.grade ?? "-"}</TableCell>
                        <TableCell>{user.section ?? "-"}</TableCell>
                        <TableCell className="text-right">
                          <UserManagementActions
                            userId={user.id}
                            isApproved={user.is_approved}
                            isActive={user.is_active}
                            role={user.role}
                            view="directory"
                            isSelf={user.id === adminProfile.id}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <EmptyState
                icon="users"
                title="No staff yet"
                description="Approved staff will appear here."
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

