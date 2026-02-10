// @ts-nocheck
// TODO: Convert to use React state instead of Next.js useFormState/useFormStatus
"use client";

import { useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
// TODO: Convert to API call to /api/profile
// import { updateProfile } from "@/app/(dashboard)/profile/actions";
const updateProfile = async (params: any): Promise<{ success?: string; error?: string }> => {
  return { error: "Not implemented - convert to API call" };
};
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface ProfileFormProps {
  initialData: {
    id: string;
    full_name: string | null;
    email: string | null;
    mobile: string | null;
    role: "admin" | "teacher";
    grade: string | null;
    section: string | null;
    room_number: string | null;
    created_at: string;
  };
  onSuccess?: () => void;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : "Save Changes"}
    </Button>
  );
}

export function ProfileForm({ initialData, onSuccess }: ProfileFormProps) {
  const [state, formAction] = useFormState(updateProfile, null);

  // Show toast on success/error
  useEffect(() => {
    if (state?.success) {
      toast.success("Profile updated successfully!");
      if (onSuccess) {
        // Small delay to allow toast to show
        setTimeout(() => {
          onSuccess();
        }, 500);
      }
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, onSuccess]);

  const isTeacher = initialData.role === "teacher";

  return (
    <form action={formAction} className="space-y-6">
      {/* Full Name - Editable, Required */}
      <div className="space-y-2">
        <label htmlFor="full_name" className="text-sm font-semibold text-[#1e293b]">
          Full Name <span className="text-[#ef4444]">*</span>
        </label>
        <Input
          id="full_name"
          name="full_name"
          type="text"
          defaultValue={initialData.full_name ?? ""}
          required
          className="input-focus-ring"
        />
      </div>

      {/* Mobile - Editable, Optional */}
      <div className="space-y-2">
        <label htmlFor="mobile" className="text-sm font-semibold text-[#1e293b]">
          Mobile Number
        </label>
        <Input
          id="mobile"
          name="mobile"
          type="tel"
          placeholder="Enter mobile number"
          defaultValue={initialData.mobile ?? ""}
          className="input-focus-ring"
        />
      </div>

      {/* Email - Read-only */}
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-semibold text-[#1e293b]">
          Email
        </label>
        <Input
          id="email"
          type="email"
          value={initialData.email ?? ""}
          disabled
          className="bg-muted cursor-not-allowed"
        />
        <p className="text-xs text-muted-foreground">
          Email cannot be changed. Contact admin if you need to update it.
        </p>
      </div>

      {/* Role - Read-only */}
      <div className="space-y-2">
        <label htmlFor="role" className="text-sm font-semibold text-[#1e293b]">
          Role
        </label>
        <Input
          id="role"
          type="text"
          value={initialData.role === "admin" ? "Admin" : "Teacher"}
          disabled
          className="bg-muted capitalize cursor-not-allowed"
        />
      </div>

      {/* Teacher-specific fields - Read-only */}
      {isTeacher && (
        <>
          <div className="space-y-2">
            <label htmlFor="grade" className="text-sm font-semibold text-[#1e293b]">
              Grade
            </label>
            <Input
              id="grade"
              type="text"
              value={initialData.grade ?? ""}
              disabled
              className="bg-muted cursor-not-allowed"
            />
            <p className="text-xs text-muted-foreground">
              Grade cannot be changed. Contact admin if you need to update it.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="section" className="text-sm font-semibold text-[#1e293b]">
              Section
            </label>
            <Input
              id="section"
              type="text"
              value={initialData.section ?? ""}
              disabled
              className="bg-muted cursor-not-allowed"
            />
            <p className="text-xs text-muted-foreground">
              Section cannot be changed. Contact admin if you need to update it.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="room_number" className="text-sm font-semibold text-[#1e293b]">
              Room Number
            </label>
            <Input
              id="room_number"
              type="text"
              value={initialData.room_number ?? ""}
              disabled
              className="bg-muted cursor-not-allowed"
            />
            <p className="text-xs text-muted-foreground">
              Room number cannot be changed. Contact admin if you need to update it.
            </p>
          </div>
        </>
      )}

      {/* Created Date - Read-only */}
      <div className="space-y-2">
        <label htmlFor="created_at" className="text-sm font-semibold text-[#1e293b]">
          Member Since
        </label>
        <Input
          id="created_at"
          type="text"
          value={
            initialData.created_at
              ? new Date(initialData.created_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              : "-"
          }
          disabled
          className="bg-muted cursor-not-allowed"
        />
      </div>

      {state?.error && !state.success && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <div className="flex justify-end gap-3 pt-4">
        <SubmitButton />
      </div>
    </form>
  );
}

