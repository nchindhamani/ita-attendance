export type Role = "admin" | "teacher" | "principal" | "attendance_officer" | "hscp_officer";

export type ArchiveStatus = "IDLE" | "ARCHIVE_READY" | "PURGING";

export type AttendanceStatus = "present" | "absent" | "late" | "left_early";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: Role;
  grade?: string | null;
  section?: string | null;
  is_active: boolean;
  is_approved: boolean;
}

// Role permissions mapping
export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  admin: [
    "Edit attendance",
    "Edit user profiles",
    "Manage roles",
    "View reports",
    "Archive & purge data"
  ],
  teacher: [
    "Edit attendance for own classes",
    "View student profiles",
    "Add students"
  ],
  principal: [
    "View student attendance",
    "View teacher attendance",
    "View user profiles"
  ],
  attendance_officer: [
    "View student profiles (read-only)",
    "Edit all attendance"
  ],
  hscp_officer: [
    "Insert/update/read attendance of HSCP teachers",
    "View student attendance of HSCP teachers (read-only)"
  ]
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: "Full access to all features",
  teacher: "Manage classes and attendance",
  principal: "Read-only access to all data",
  attendance_officer: "Manage attendance only",
  hscp_officer: "Manage HSCP teachers and their students"
};

export const ROLE_ICONS: Record<Role, string> = {
  admin: "🛡️",
  teacher: "👥",
  principal: "👁️",
  attendance_officer: "📅",
  hscp_officer: "🏥"
};

