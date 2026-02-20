// @ts-nocheck
"use client";

import { useState, useEffect, useRef } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
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

export function ProfileForm({ initialData, onSuccess }: ProfileFormProps) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createSupabaseBrowserClient();
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);
    setError(null);

    try {
      // Get JWT token from Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Not authenticated. Please sign in again.");
      }

      // Get form element - use ref as fallback if e.currentTarget is not available
      const formElement = formRef.current || (e.currentTarget instanceof HTMLFormElement ? e.currentTarget : null);
      
      if (!formElement) {
        throw new Error("Form element not found");
      }

      // Get form data
      const formData = new FormData(formElement);
      const full_name = String(formData.get("full_name") ?? "").trim();
      const mobile = String(formData.get("mobile") ?? "").trim();

      // Call Python API
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          full_name,
          mobile: mobile || null,
        }),
      });

      // Check if response has content before parsing
      const contentType = response.headers.get("content-type");
      const responseText = await response.text();

      // Handle empty responses
      if (!responseText || responseText.trim() === "") {
        throw new Error(`Server error: ${response.status} ${response.statusText}. Empty response from server.`);
      }

      // Check if response is JSON
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(`Server error: ${response.status} ${response.statusText}. ${responseText.substring(0, 200)}`);
      }

      // Parse JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error(`Failed to parse server response: ${responseText.substring(0, 200)}`);
      }

      if (!response.ok) {
        throw new Error(data.error || data.detail || `Server error: ${response.status}`);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      // Success
      toast.success("Profile updated successfully!");
      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
        }, 500);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update profile";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsPending(false);
    }
  };

  const isTeacher = initialData.role === "teacher";

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
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

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="flex justify-end gap-3 pt-4">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}

