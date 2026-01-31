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
  const grade = String(formData.get("grade") ?? "").trim();
  const section = String(formData.get("section") ?? "").trim();
  const roomNumber = String(formData.get("room_number") ?? "").trim();

  // Validation: mandatory fields cannot be empty
  if (!fullName) {
    return { error: "Full name is required and cannot be empty." };
  }

  // For teachers, grade, section, and room_number are mandatory
  if (profile.role === "teacher") {
    if (!grade) {
      return { error: "Grade is required for teachers and cannot be empty." };
    }
    if (!section) {
      return { error: "Section is required for teachers and cannot be empty." };
    }
    if (!roomNumber) {
      return {
        error: "Room number is required for teachers and cannot be empty.",
      };
    }
  }

  // Build update object
  const updateData: {
    full_name: string;
    mobile?: string | null;
    grade?: string | null;
    section?: string | null;
    room_number?: string | null;
  } = {
    full_name: fullName,
  };

  // For teachers, always include grade/section/room_number
  if (profile.role === "teacher") {
    updateData.grade = grade;
    updateData.section = section;
    updateData.room_number = roomNumber;
  }

  // Mobile is optional for all users
  updateData.mobile = mobile || null;

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

