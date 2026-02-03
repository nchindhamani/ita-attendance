"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Role } from "@/lib/types";

async function assertAdmin(): Promise<
  | { error: string; profile?: undefined }
  | { profile: { id: string; role: Role; is_active: boolean; is_approved: boolean }; error?: undefined }
> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,role,is_active,is_approved")
    .eq("id", user.id)
    .maybeSingle<{
      id: string;
      role: Role;
      is_active: boolean;
      is_approved: boolean;
    }>();

  if (!profile || profile.role !== "admin" || !profile.is_active || !profile.is_approved) {
    return { error: "Unauthorized" };
  }

  return { profile };
}

export async function approveUserAsRole(profileId: string, role: Role) {
  const adminCheck = await assertAdmin();
  if (adminCheck.error) return { error: adminCheck.error };
  if (adminCheck.profile?.id === profileId) {
    return { error: "Cannot approve yourself." };
  }

  const admin = createSupabaseAdminClient();

  if (role === "teacher") {
    const { data: teacher } = await admin
      .from("profiles")
      .select("grade,section,room_number")
      .eq("id", profileId)
      .maybeSingle<{
        grade: string | null;
        section: string | null;
        room_number: string | null;
      }>();

    if (!teacher?.grade || !teacher?.section || !teacher.room_number) {
      return { error: "Teacher grade/section is missing." };
    }

    const { data: settings } = await admin
      .from("system_settings")
      .select("current_school_year")
      .eq("id", 1)
      .single();

    const currentSchoolYear = settings?.current_school_year ?? "2025-2026";

    const { data: existingSection } = await admin
      .from("sections")
      .select("id,room_number")
      .eq("grade", teacher.grade)
      .eq("section", teacher.section)
      .eq("school_year", currentSchoolYear)
      .maybeSingle();

    let sectionId = existingSection?.id ?? null;
    if (existingSection) {
      if (existingSection.room_number !== teacher.room_number) {
        return {
          error:
            "Room number mismatch for this grade and section. Please verify.",
        };
      }
    } else {
      const { data: insertedSection } = await admin
        .from("sections")
        .insert({
          grade: teacher.grade,
          section: teacher.section,
          room_number: teacher.room_number,
          school_year: currentSchoolYear,
        })
        .select("id")
        .single();
      sectionId = insertedSection?.id ?? null;
    }

    if (!sectionId) {
      return { error: "Unable to create section for this teacher." };
    }

    await admin.from("teacher_sections").upsert(
      {
        teacher_id: profileId,
        section_id: sectionId,
      },
      {
        onConflict: "teacher_id,section_id",
      }
    );
  }

  await admin
    .from("profiles")
    .update({
      is_approved: true,
      is_active: true,
      role: role === "admin" ? "admin" : "teacher",
    })
    .eq("id", profileId);
  revalidatePath("/admin/users");
  return { success: "User approved." };
}

export async function toggleUserActiveStatus(
  profileId: string,
  isActive: boolean
) {
  const adminCheck = await assertAdmin();
  if (adminCheck.error) return { error: adminCheck.error };
  if (adminCheck.profile?.id === profileId) {
    return { error: "Cannot change your own status." };
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", profileId);

  if (error) {
    return { error: error.message || "Failed to update user status." };
  }

  revalidatePath("/admin/users");
  return { success: "Status updated." };
}

export async function updateUserRole(profileId: string, role: Role) {
  const adminCheck = await assertAdmin();
  if (adminCheck.error) return { error: adminCheck.error };
  if (adminCheck.profile?.id === profileId) {
    return { error: "Cannot change your own role." };
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ role })
    .eq("id", profileId);

  if (error) {
    return { error: error.message || "Failed to update user role." };
  }

  revalidatePath("/admin/users");
  return { success: "Role updated." };
}

