"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { Role } from "@/lib/types";
import {
  approveUserAsRole,
  toggleUserActiveStatus,
  updateUserRole,
} from "@/app/(dashboard)/admin/users/actions";

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
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [teacherGranted, setTeacherGranted] = useState(false);
  const [adminGranted, setAdminGranted] = useState(false);

  const handleApprove = (nextRole: Role) => {
    startTransition(async () => {
      const result = await approveUserAsRole(userId, nextRole);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Access approved successfully.");
        router.refresh();
      }
    });
  };

  const handleActiveToggle = (checked: boolean) => {
    startTransition(async () => {
      try {
        const result = await toggleUserActiveStatus(userId, checked);
        if (result?.error) {
          toast.error(result.error);
        } else {
          toast.success(checked ? "User activated." : "User deactivated.");
          router.refresh();
        }
      } catch (error) {
        toast.error("Failed to update user status. Please try again.");
        console.error("Error toggling active status:", error);
      }
    });
  };

  const handleRoleChange = (checked: boolean) => {
    const nextRole: Role = checked ? "admin" : "teacher";
    startTransition(async () => {
      try {
        const result = await updateUserRole(userId, nextRole);
        if (result?.error) {
          toast.error(result.error);
        } else {
          toast.success(`User role updated to ${nextRole}.`);
          router.refresh();
        }
      } catch (error) {
        toast.error("Failed to update user role. Please try again.");
        console.error("Error updating role:", error);
      }
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

