"use server";

import { revalidatePath } from "next/cache";
import { requireActiveProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAfterDailyCutoff } from "@/lib/time";
import { AttendanceStatus } from "@/lib/types";

export type AttendanceEntryInput = {
  studentId: string;
  status: AttendanceStatus;
  comments?: string;
};

export async function saveAttendance(payload: {
  sectionId: string;
  attendanceDate: string;
  schoolYear: string;
  entries: AttendanceEntryInput[];
}) {
  const profile = await requireActiveProfile();
  if (isAfterDailyCutoff(new Date())) {
    return { error: "Attendance is locked after 3:00 PM PT." };
  }

  const supabase = createSupabaseServerClient();
  const upserts = payload.entries.map((entry) => ({
    student_id: entry.studentId,
    recorded_by: profile.id,
    attendance_date: payload.attendanceDate,
    status: entry.status,
    comments: entry.comments ?? null,
    school_year: payload.schoolYear,
  }));

  const { error } = await supabase.from("attendance").upsert(upserts, {
    onConflict: "student_id,attendance_date",
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/attendance?section=${payload.sectionId}`);
  return { success: "Attendance saved." };
}

export async function addStudent(payload: {
  sectionId: string;
  schoolYear: string;
  fullName: string;
}) {
  await requireActiveProfile();
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("students").insert({
    full_name: payload.fullName,
    section_id: payload.sectionId,
    school_year: payload.schoolYear,
  });
  if (error) {
    return { error: error.message };
  }
  revalidatePath(`/attendance?section=${payload.sectionId}`);
  return { success: "Student added." };
}

export async function addStudentsFromCsv(payload: {
  sectionId: string;
  schoolYear: string;
  names: string[];
}) {
  await requireActiveProfile();
  const supabase = createSupabaseServerClient();
  const records = payload.names
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({
      full_name: name,
      section_id: payload.sectionId,
      school_year: payload.schoolYear,
    }));

  if (records.length === 0) {
    return { error: "No valid student names found in CSV." };
  }

  const { error } = await supabase.from("students").insert(records);
  if (error) {
    return { error: error.message };
  }
  revalidatePath(`/attendance?section=${payload.sectionId}`);
  return { success: "Student roster uploaded." };
}

