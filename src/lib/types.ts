export type Role = "admin" | "teacher";

export type ArchiveStatus = "IDLE" | "ARCHIVE_READY" | "PURGING";

export type AttendanceStatus = "present" | "absent" | "late" | "left_early";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: Role;
  is_active: boolean;
  is_approved: boolean;
}

