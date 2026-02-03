"use server";

import { revalidatePath } from "next/cache";
import { requireActiveProfile } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { capitalizeName } from "@/lib/utils";

export async function updateProfile(
  _prevState: { error?: string; success?: boolean } | null,
  formData: FormData
) {
  const profile = await requireActiveProfile();
  const admin = createSupabaseAdminClient();

  const fullName = capitalizeName(String(formData.get("full_name") ?? "").trim());
  const mobile = String(formData.get("mobile") ?? "").trim();

  // Validation: full name is required
  if (!fullName) {
    return { error: "Full name is required and cannot be empty." };
  }

  // Build update object - only update editable fields
  const updateData: {
    full_name: string;
    mobile?: string | null;
  } = {
    full_name: fullName,
    mobile: mobile || null, // Mobile is optional
  };

  const { error } = await admin
    .from("profiles")
    .update(updateData)
    .eq("id", profile.id);

  if (error) {
    return {
      error: error.message || "Failed to update profile. Please try again.",
    };
  }

  revalidatePath("/profile");
  return { success: true };
}

