"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function signUpWithPassword(
  _prevState: { error?: string },
  formData: FormData
) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const mobile = String(formData.get("mobile") ?? "").trim();
  const grade = String(formData.get("grade") ?? "").trim();
  const section = String(formData.get("section") ?? "").trim();
  const roomNumber = String(formData.get("room_number") ?? "").trim();
  const roleInput = String(formData.get("role") ?? "teacher");
  const normalizedRole = roleInput === "admin" ? "admin" : "teacher";

  if (!email || !password || !fullName) {
    return { error: "Please provide your name, email, and password." };
  }

  if (normalizedRole === "teacher" && (!grade || !section || !roomNumber)) {
    return {
      error: "Grade, section, and room number are required for teachers.",
    };
  }

  const supabase = createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const { data: existing } = await supabase
    .from("profiles")
    .select("id,is_active")
    .eq("email", email)
    .maybeSingle<{ id: string; is_active: boolean }>();

  if (existing?.id) {
    return {
      error: existing.is_active
        ? "Your email already exists. If you forgot your password, please reset it."
        : "Your profile has been deactivated. Please contact the admin.",
    };
  }

  const { data: settings } = await admin
    .from("system_settings")
    .select("current_school_year")
    .eq("id", 1)
    .single();

  const currentSchoolYear = settings?.current_school_year ?? "2025-2026";

  if (normalizedRole === "teacher") {
    const { data: existingSection } = await admin
      .from("sections")
      .select("id,room_number")
      .eq("grade", grade)
      .eq("section", section)
      .eq("school_year", currentSchoolYear)
      .maybeSingle();

    if (
      existingSection &&
      existingSection.room_number &&
      roomNumber &&
      existingSection.room_number !== roomNumber
    ) {
      return {
        error:
          "Please check the room number for the selected grade and section.",
      };
    }
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Email verification disabled for testing.
      // emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/auth/callback?next=/auth/verify-email`,
      data: { full_name: fullName },
    },
  });

  if (error || !data.user) {
    return { error: error?.message ?? "Unable to sign up." };
  }

  await admin.from("profiles").insert({
    id: data.user.id,
    email,
    full_name: fullName,
    mobile: mobile || null,
    grade: grade || null,
    section: section || null,
    room_number: roomNumber || null,
    role: normalizedRole,
    is_active: false,
    is_approved: false,
  });

  // Email verification disabled for testing.
  // redirect("/auth/verify-email");
  redirect("/auth/login");
}

export async function signInWithPassword(
  _prevState: { error?: string },
  formData: FormData
) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Please provide your email and password." };
  }

  const supabase = createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("profiles")
    .select("id,is_active")
    .eq("email", email)
    .maybeSingle<{ id: string; is_active: boolean }>();

  if (existing?.id && !existing.is_active) {
    return {
      error: "Your profile has been deactivated. Please contact the admin.",
    };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function requestPasswordReset(
  _prevState: { error?: string; success?: string },
  formData: FormData
) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email) {
    return { error: "Enter your email address." };
  }

  const supabase = createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("profiles")
    .select("id,is_active")
    .eq("email", email)
    .maybeSingle<{ id: string; is_active: boolean }>();

  if (existing?.id && !existing.is_active) {
    return {
      error: "Your profile has been deactivated. Please contact the admin.",
    };
  }

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/auth/callback?next=/auth/update-password`,
  });

  return { success: "Password reset instructions sent." };
}

export async function updatePassword(
  _prevState: { error?: string },
  formData: FormData
) {
  const password = String(formData.get("password") ?? "");
  if (!password) {
    return { error: "Please enter a new password." };
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_active")
      .eq("id", user.id)
      .maybeSingle<{ is_active: boolean }>();
    if (profile && !profile.is_active) {
      await supabase.auth.signOut();
      return {
        error: "Your profile has been deactivated. Please contact the admin.",
      };
    }
  }
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

