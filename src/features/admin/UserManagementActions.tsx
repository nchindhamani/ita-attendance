"use client";

import { useState, useTransition } from "react";
// import { useRouter } from "next/navigation"; // Not needed in React Router
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { Role } from "@/lib/types";
// TODO: Convert to API calls to /api/admin/users
// import {
//   approveUserAsRole,
//   toggleUserActiveStatus,
//   updateUserRole,
// } from "@/app/(dashboard)/admin/users/actions";

// Stub functions - to be replaced with API calls
const approveUserAsRole = async (userId: string, role: string): Promise<{ success?: string; error?: string }> => ({ error: "Not implemented" });
const toggleUserActiveStatus = async (userId: string): Promise<{ success?: string; error?: string }> => ({ error: "Not implemented" });
const updateUserRole = async (userId: string, role: string): Promise<{ success?: string; error?: string }> => ({ error: "Not implemented" });

export function UserManagementActions({
  userId,
  isApproved,
  isActive,
  role,
  view,
  isSelf,
}: {
  userId: string;
  isApproved: boolean;
  isActive: boolean;
  role: Role;
  view: "approval" | "directory";
  isSelf?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [teacherGranted, setTeacherGranted] = useState(false);
  const [adminGranted, setAdminGranted] = useState(false);

  const handleApprove = (nextRole: Role) => {
    startTransition(() => {
      approveUserAsRole(userId, nextRole).then((result) => {
        if (result?.error) {
          toast.error(result.error);
        } else {
          toast.success("Access approved successfully.");
        }
      });
    });
  };

  const handleActiveToggle = (checked: boolean) => {
    startTransition(() => {
      toggleUserActiveStatus(userId, checked).then((result) => {
        if (result?.error) {
          toast.error(result.error);
        } else {
          toast.success(checked ? "User activated." : "User deactivated.");
        }
      }).catch((error) => {
        toast.error("Failed to update user status. Please try again.");
        console.error("Error toggling active status:", error);
      });
    });
  };

  const handleRoleChange = (checked: boolean) => {
    const nextRole: Role = checked ? "admin" : "teacher";
    startTransition(() => {
      updateUserRole(userId, nextRole).then((result) => {
        if (result?.error) {
          toast.error(result.error);
        } else {
          toast.success(`User role updated to ${nextRole}.`);
        }
      }).catch((error) => {
        toast.error("Failed to update user role. Please try again.");
        console.error("Error updating role:", error);
      });
    });
  };

  if (view === "approval") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Switch
            checked={teacherGranted}
            onCheckedChange={() => {
              setTeacherGranted(true);
              handleApprove("teacher");
            }}
            disabled={isPending || isApproved || adminGranted}
          />
          <span className="text-xs text-muted-foreground">Active</span>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={adminGranted}
            onCheckedChange={() => {
              setAdminGranted(true);
              handleApprove("admin");
            }}
            disabled={isPending || isApproved || teacherGranted}
          />
          <span className="text-xs text-muted-foreground">Admin</span>
        </div>
      </div>
    );
  }

  if (isSelf) {
    return (
      <div className="text-xs text-muted-foreground">Current admin</div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <Switch
          checked={isActive}
          onCheckedChange={handleActiveToggle}
          disabled={isPending}
        />
        <span className="text-xs text-muted-foreground">Active</span>
      </div>
      <div className="flex items-center gap-2">
        <Switch
          checked={role === "admin"}
          onCheckedChange={handleRoleChange}
          disabled={isPending}
        />
        <span className="text-xs text-muted-foreground">Admin</span>
      </div>
    </div>
  );
}

