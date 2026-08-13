export type Role = "admin" | "teacher" | "principal" | "attendance_officer" | "hscp_officer" | "volunteer";

export type ArchiveStatus = "IDLE" | "ARCHIVE_READY" | "PURGING";

export type AttendanceStatus = "present" | "absent" | "late" | "left_early";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: Role;
  grade?: string | null;
  section?: string | null;
  description?: string | null;
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
    "View student profiles"
  ],
  principal: [
    "View student attendance",
    "View teacher attendance",
    "View user profiles",
    "Record volunteer/staff attendance"
  ],
  attendance_officer: [
    "View student profiles (read-only)",
    "Edit all attendance"
  ],
  hscp_officer: [
    "Insert/update/read attendance of HSCP teachers",
    "View student attendance of HSCP teachers (read-only)"
  ],
  volunteer: [
    "No portal access"
  ]
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: "Full access to all features",
  teacher: "View class roster and record attendance",
  principal: "Read-only access to all data",
  attendance_officer: "Manage attendance only",
  hscp_officer: "Manage HSCP teachers and their students",
  volunteer: "No portal access - attendance tracked by principals"
};

/** Short display labels for the signed-in user subtitle. */
export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  teacher: "Teacher",
  principal: "Principal",
  attendance_officer: "Attendance Officer",
  hscp_officer: "HSCP Officer",
  volunteer: "Volunteer",
};

export const ROLE_ICONS: Record<Role, string> = {
  admin: "🛡️",
  teacher: "👥",
  principal: "👁️",
  attendance_officer: "📅",
  hscp_officer: "🏥",
  volunteer: "🤝"
};

