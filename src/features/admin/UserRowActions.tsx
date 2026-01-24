"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  approveTeacher,
  toggleTeacherActive,
} from "@/app/(dashboard)/admin/users/actions";

export function UserRowActions({
  profileId,
  isApproved,
  isActive,
  displayName,
}: {
  profileId: string;
  isApproved: boolean;
  isActive: boolean;
  displayName: string;
}) {
  const [isPending, startTransition] = useTransition();

  const handleApprove = () => {
    startTransition(async () => {
      await approveTeacher(profileId);
      toast.success(`Teacher ${displayName} approved. Notification email sent.`);
    });
  };

  const handleToggle = () => {
    startTransition(async () => {
      await toggleTeacherActive(profileId, !isActive);
      toast.success(
        `${displayName} ${isActive ? "deactivated" : "activated"}.`
      );
    });
  };

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {!isApproved ? (
        <Button size="sm" onClick={handleApprove} disabled={isPending}>
          Approve
        </Button>
      ) : null}
      <Button
        size="sm"
        variant="outline"
        onClick={handleToggle}
        disabled={isPending}
      >
        {isActive ? "Deactivate" : "Activate"}
      </Button>
    </div>
  );
}

