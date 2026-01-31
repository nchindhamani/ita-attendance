"use client";

import { useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { updateProfile } from "@/app/(dashboard)/profile/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : "Save Changes"}
    </Button>
  );
}

export function ProfileForm({ initialData }: ProfileFormProps) {
  const [state, formAction] = useFormState(updateProfile, null);

  // Show toast on success/error
  useEffect(() => {
    if (state?.success) {
      toast.success("Profile updated successfully!");
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state]);

  const isTeacher = initialData.role === "teacher";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          {/* Email - Read-only */}
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={initialData.email ?? ""}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Email cannot be changed. Contact admin if you need to update it.
            </p>
          </div>

          {/* Full Name - Required */}
          <div className="space-y-2">
            <label htmlFor="full_name" className="text-sm font-medium">
              Full Name <span className="text-destructive">*</span>
            </label>
            <Input
              id="full_name"
              name="full_name"
              type="text"
              defaultValue={initialData.full_name ?? ""}
              required
            />
          </div>

          {/* Mobile - Optional */}
          <div className="space-y-2">
            <label htmlFor="mobile" className="text-sm font-medium">
              Mobile
            </label>
            <Input
              id="mobile"
              name="mobile"
              type="tel"
              placeholder="Enter mobile number"
              defaultValue={initialData.mobile ?? ""}
            />
          </div>

          {/* Teacher-specific fields */}
          {isTeacher && (
            <>
              <div className="space-y-2">
                <label htmlFor="grade" className="text-sm font-medium">
                  Grade <span className="text-destructive">*</span>
                </label>
                <Input
                  id="grade"
                  name="grade"
                  type="text"
                  defaultValue={initialData.grade ?? ""}
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="section" className="text-sm font-medium">
                  Section <span className="text-destructive">*</span>
                </label>
                <Input
                  id="section"
                  name="section"
                  type="text"
                  defaultValue={initialData.section ?? ""}
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="room_number" className="text-sm font-medium">
                  Room Number <span className="text-destructive">*</span>
                </label>
                <Input
                  id="room_number"
                  name="room_number"
                  type="text"
                  defaultValue={initialData.room_number ?? ""}
                  required
                />
              </div>
            </>
          )}

          {/* Role - Read-only */}
          <div className="space-y-2">
            <label htmlFor="role" className="text-sm font-medium">
              Role
            </label>
            <Input
              id="role"
              type="text"
              value={initialData.role === "admin" ? "Admin" : "Teacher"}
              disabled
              className="bg-muted capitalize"
            />
          </div>

          {/* Created Date - Read-only */}
          <div className="space-y-2">
            <label htmlFor="created_at" className="text-sm font-medium">
              Account Created
            </label>
            <Input
              id="created_at"
              type="text"
              value={
                initialData.created_at
                  ? new Date(initialData.created_at).toLocaleString()
                  : "-"
              }
              disabled
              className="bg-muted"
            />
          </div>

          {state?.error && !state.success && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <SubmitButton />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

