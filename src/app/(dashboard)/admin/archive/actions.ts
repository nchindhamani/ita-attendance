// @ts-nocheck
"use server";

import Papa from "papaparse";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function toCsv(data: Record<string, unknown>[]) {
  return Papa.unparse(data);
}

type AttendanceRow = {
  attendance_date: string;
  status: string;
  comments: string | null;
  school_year: string;
  students:
    | { full_name: string | null; section_id: string | null }
    | { full_name: string | null; section_id: string | null }[]
    | null;
};

export async function prepareArchive() {
  await requireRole("admin");
  const admin = createSupabaseAdminClient();

  const { data: settings } = await admin
    .from("system_settings")
    .select("current_school_year,archive_status")
    .eq("id", 1)
    .single();

  if (!settings) {
    return { error: "System settings not found." };
  }

  if (settings.archive_status !== "IDLE") {
    return { error: "Archive preparation already in progress." };
  }

  const schoolYear = settings.current_school_year;
  const { data: students } = await admin
    .from("students")
    .select("id,full_name,section_id,school_year")
    .eq("school_year", schoolYear);

  const { data: attendance } = await admin
    .from("attendance")
    .select(
      "attendance_date,status,comments,school_year,students(full_name,section_id)"
    )
    .eq("school_year", schoolYear);

  const studentsCsv = toCsv(students ?? []);
  const attendanceCsv = toCsv(
    (attendance as AttendanceRow[] | null | undefined ?? []).map((row) => {
      const student = Array.isArray(row.students)
        ? row.students[0]
        : row.students;
      return {
      attendance_date: row.attendance_date,
      status: row.status,
      comments: row.comments,
      school_year: row.school_year,
      student_name: student?.full_name ?? "",
      section_id: student?.section_id ?? "",
    };
    })
  );

  const basePath = `staging/${schoolYear}`;
  await admin.storage
    .from("ITA_attendance_archives")
    .upload(`${basePath}/students.csv`, studentsCsv, {
      contentType: "text/csv",
      upsert: true,
    });
  await admin.storage
    .from("ITA_attendance_archives")
    .upload(`${basePath}/attendance.csv`, attendanceCsv, {
      contentType: "text/csv",
      upsert: true,
    });

  await admin
    .from("system_settings")
    .update({ archive_status: "ARCHIVE_READY", archive_path: basePath })
    .eq("id", 1);

  revalidatePath("/admin/archive");
  return { success: "Archive prepared." };
}

export async function purgeArchive(confirmed: boolean) {
  await requireRole("admin");
  if (!confirmed) {
    return { error: "Please verify the data before purging." };
  }

  const admin = createSupabaseAdminClient();
  const { data: settings } = await admin
    .from("system_settings")
    .select("current_school_year,archive_status")
    .eq("id", 1)
    .single();

  if (!settings || settings.archive_status !== "ARCHIVE_READY") {
    return { error: "Archive is not ready for purge." };
  }

  await admin
    .from("system_settings")
    .update({ archive_status: "PURGING" })
    .eq("id", 1);

  const schoolYear = settings.current_school_year;
  await admin.from("attendance").delete().eq("school_year", schoolYear);
  await admin.from("students").delete().eq("school_year", schoolYear);
  await admin.from("sections").delete().eq("school_year", schoolYear);

  await admin
    .from("system_settings")
    .update({ archive_status: "IDLE", archive_path: null })
    .eq("id", 1);

  revalidatePath("/admin/archive");
  return { success: "Database purged for current school year." };
}

