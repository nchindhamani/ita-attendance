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

  const handleActiveToggle = (nextActive: boolean) => {
    startTransition(async () => {
      const result = await toggleUserActiveStatus(userId, nextActive);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Account status updated.");
        router.refresh();
      }
    });
  };

  const handleRoleChange = (nextRole: Role) => {
    startTransition(async () => {
      const result = await updateUserRole(userId, nextRole);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Role updated.");
        router.refresh();
      }
    });
  };

  if (view === "approval") {
    return (
      <div className="flex flex-wrap items-center justify-end gap-3">
        <div className="flex items-center gap-2">
          <Switch
            checked={teacherGranted}
            onCheckedChange={() => {
              setTeacherGranted(true);
              handleApprove("teacher");
            }}
            disabled={isPending || isApproved || adminGranted}
          />
          <span className="text-xs text-muted-foreground">Teacher access</span>
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
          <span className="text-xs text-muted-foreground">Admin access</span>
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
    <div className="flex flex-wrap items-center justify-end gap-3">
      <div className="flex items-center gap-2">
        <Switch
          checked={role === "admin"}
          onCheckedChange={(checked) =>
            handleRoleChange(checked ? "admin" : "teacher")
          }
          disabled={isPending}
        />
        <span className="text-xs text-muted-foreground">Admin access</span>
      </div>
      <div className="flex items-center gap-2">
        <Switch
          checked={isActive}
          onCheckedChange={handleActiveToggle}
          disabled={isPending}
        />
        <span className="text-xs text-muted-foreground">
          {isActive ? "Active" : "Inactive"}
        </span>
      </div>
    </div>
  );
}

