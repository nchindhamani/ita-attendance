"use server";

import { revalidatePath } from "next/cache";
import { requireActiveProfile } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
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
  const { data: holiday } = await supabase
    .from("holidays")
    .select("holiday_date")
    .eq("school_year", payload.schoolYear)
    .eq("holiday_date", payload.attendanceDate)
    .maybeSingle();

  if (holiday) {
    return { error: "This date is marked as a holiday." };
  }
  const { data: studentRows } = await supabase
    .from("students")
    .select("id,student_identifier,section_id")
    .in(
      "id",
      payload.entries.map((entry) => entry.studentId)
    );

  const studentMap = new Map(
    (studentRows ?? []).map((row) => [row.id, row])
  );

  const upserts = payload.entries.map((entry) => {
    const student = studentMap.get(entry.studentId);
    return {
      student_id: entry.studentId,
      student_identifier: student?.student_identifier ?? null,
      section_id: student?.section_id ?? null,
      recorded_by: profile.id,
      attendance_date: payload.attendanceDate,
      status: entry.status,
      comments: entry.comments ?? null,
      school_year: payload.schoolYear,
      created_at: new Date().toISOString(),
    };
  });

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
  studentIdentifier: string;
  fullName: string;
}) {
  const profile = await requireActiveProfile();
  if (!payload.sectionId) {
    return { error: "Missing section for this class." };
  }
  const admin = createSupabaseAdminClient();

  const studentIdentifier = Number(payload.studentIdentifier);
  if (!Number.isInteger(studentIdentifier)) {
    return { error: "Student ID must be a number." };
  }

  const { data: section } = await admin
    .from("sections")
    .select("school_year")
    .eq("id", payload.sectionId)
    .maybeSingle<{ school_year: string }>();

  if (!section) {
    return { error: "Section not found." };
  }

  const { data: inserted, error } = await admin
    .from("students")
    .insert({
      student_identifier: studentIdentifier,
      full_name: payload.fullName,
      section_id: payload.sectionId,
      school_year: section.school_year ?? payload.schoolYear,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { error: error?.message ?? "Unable to add student." };
  }

  const { data: attendanceDates } = await admin
    .from("attendance")
    .select("attendance_date,students!inner(grade,section,school_year)")
    .eq("students.section_id", payload.sectionId);

  const uniqueDates = Array.from(
    new Set((attendanceDates ?? []).map((row) => row.attendance_date))
  );

  if (uniqueDates.length > 0) {
    const { data: holidays } = await admin
      .from("holidays")
      .select("holiday_date")
      .eq("school_year", payload.schoolYear)
      .in("holiday_date", uniqueDates);
    const holidaySet = new Set((holidays ?? []).map((row) => row.holiday_date));
    const backfill = uniqueDates
      .filter((date) => !holidaySet.has(date))
      .map((date) => ({
      student_id: inserted.id,
        student_identifier: studentIdentifier,
        section_id: payload.sectionId,
      recorded_by: profile.id,
      attendance_date: date,
      status: "absent",
      comments: null,
      school_year: payload.schoolYear,
    }));
    await admin.from("attendance").upsert(backfill, {
      onConflict: "student_id,attendance_date",
    });
  }

  revalidatePath(`/attendance?section=${payload.sectionId}`);
  return { success: "Student added." };
}

export async function addStudentsFromCsv(payload: {
  sectionId: string;
  schoolYear: string;
  students: { studentIdentifier: string; fullName: string }[];
}) {
  const profile = await requireActiveProfile();
  if (!payload.sectionId) {
    return { error: "Missing section for this class." };
  }
  const admin = createSupabaseAdminClient();

  const { data: section } = await admin
    .from("sections")
    .select("school_year")
    .eq("id", payload.sectionId)
    .maybeSingle<{ school_year: string }>();

  if (!section) {
    return { error: "Section not found." };
  }

  const records = payload.students
    .map((student) => {
      const studentIdentifier = Number(student.studentIdentifier.trim());
      return {
        student_identifier: Number.isInteger(studentIdentifier)
          ? studentIdentifier
          : null,
        full_name: student.fullName.trim(),
        section_id: payload.sectionId,
        school_year: section.school_year ?? payload.schoolYear,
      };
    })
    .filter((student) => student.student_identifier && student.full_name);

  if (records.length === 0) {
    return { error: "No valid student rows found in CSV." };
  }

  const { data: inserted, error } = await admin
    .from("students")
    .insert(records)
    .select("id");
  if (error || !inserted) {
    return { error: error?.message ?? "Unable to upload roster." };
  }

  const { data: attendanceDates } = await admin
    .from("attendance")
    .select("attendance_date,students!inner(grade,section,school_year)")
    .eq("students.section_id", payload.sectionId);

  const uniqueDates = Array.from(
    new Set((attendanceDates ?? []).map((row) => row.attendance_date))
  );

  if (uniqueDates.length > 0) {
    const { data: holidays } = await admin
      .from("holidays")
      .select("holiday_date")
      .eq("school_year", payload.schoolYear)
      .in("holiday_date", uniqueDates);
    const holidaySet = new Set((holidays ?? []).map((row) => row.holiday_date));
    const eligibleDates = uniqueDates.filter((date) => !holidaySet.has(date));
    const backfill = inserted.flatMap((student) =>
      eligibleDates.map((date) => ({
        student_id: student.id,
        student_identifier: student.student_identifier ?? null,
        section_id: payload.sectionId,
        recorded_by: profile.id,
        attendance_date: date,
        status: "absent",
        comments: null,
        school_year: payload.schoolYear,
      }))
    );
    await admin.from("attendance").upsert(backfill, {
      onConflict: "student_id,attendance_date",
    });
  }

  revalidatePath(`/attendance?section=${payload.sectionId}`);
  return { success: "Student roster uploaded." };
}

export async function updateStudent(payload: {
  studentId: string;
  studentIdentifier: string;
  fullName: string;
  sectionId: string;
}) {
  await requireActiveProfile();
  const admin = createSupabaseAdminClient();

  const studentIdentifier = Number(payload.studentIdentifier);
  if (!Number.isInteger(studentIdentifier)) {
    return { error: "Student ID must be a number." };
  }

  const { error } = await admin
    .from("students")
    .update({
      student_identifier: studentIdentifier,
      full_name: payload.fullName.trim(),
    })
    .eq("id", payload.studentId);

  if (error) {
    return { error: error.message };
  }

  await admin
    .from("attendance")
    .update({ student_identifier: studentIdentifier })
    .eq("student_id", payload.studentId);

  revalidatePath(`/attendance?section=${payload.sectionId}`);
  return { success: "Student updated." };
}

