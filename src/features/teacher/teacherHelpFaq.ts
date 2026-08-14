export type TeacherHelpFaqItem = {
  id: string
  question: string
  answer: string[]
}

/**
 * Teacher Help FAQ — exclusive accordion content for in-app Help.
 * Keep answers short, step-based, and aligned with current portal behavior.
 * Exact menu / UI labels are wrapped in single quotes.
 */
export const TEACHER_HELP_FAQ: TeacherHelpFaqItem[] = [
  {
    id: 'mark-attendance',
    question: 'How do I mark attendance for my class?',
    answer: [
      "Open 'Mark Attendance' from the menu.",
      'Choose the date from the calendar.',
      "For each student, select 'Present', 'Absent', 'Late', or 'Left Early'. Add a short comment if needed.",
      "Click 'Save attendance' and wait for the success message before leaving the page.",
    ],
  },
  {
    id: 'update-attendance',
    question: 'How do I update or correct attendance later?',
    answer: [
      "Open 'Mark Attendance'.",
      'Select the past working day you need to correct.',
      "Change the student statuses as needed, then click 'Save attendance'.",
    ],
  },
  {
    id: 'view-by-date',
    question: 'How do I view attendance for a specific date?',
    answer: [
      "Open 'Date Lookup' from the menu.",
      'Choose the date you want to review.',
      'Review each student’s attendance status and the summary counts for that day.',
    ],
  },
  {
    id: 'view-roster',
    question: 'How do I see the students in my class?',
    answer: [
      "Open 'My Students' from the menu.",
      'Review your assigned grade, section, school year, and room.',
      "The 'Students' list shows each student’s ITA Student ID and name for the current school year.",
    ],
  },
  {
    id: 'student-history',
    question: 'How do I view a particular student’s attendance history?',
    answer: [
      "Open 'Student Lookup' from the menu.",
      "Enter the student’s ITA Student ID and click 'Search'.",
      'Review the student details and their attendance history for the current school year.',
    ],
  },
  {
    id: 'update-profile',
    question: 'How do I update my profile?',
    answer: [
      "On desktop, open 'My Profile' from the menu. On mobile, tap 'More' at the bottom of the screen, then choose 'My Profile'.",
      "Click 'Edit Profile'.",
      'Update your details, save your changes, then confirm they appear correctly.',
    ],
  },
  {
    id: 'cannot-save',
    question: 'Why can’t I save attendance?',
    answer: [
      'Make sure you selected a status for at least one student.',
      'Choose an ITA working day. Non-working days cannot be saved.',
      'Future class days can be viewed, but saving opens on or after that date.',
      'If the problem continues, contact your school administrator.',
    ],
  },
  {
    id: 'missing-class',
    question: 'What if my class or students are missing?',
    answer: [
      "On 'My Students', confirm whether a class is assigned for the current school year.",
      'If no class is assigned, or students are missing from your roster, contact an administrator.',
      'Teachers view the roster here. Adding or editing students is handled by Admin or HSCP Officer.',
    ],
  },
  {
    id: 'sign-out',
    question: 'How do I sign out?',
    answer: [
      "On desktop, use 'Sign out' in the sidebar.",
      "On mobile, tap 'More' at the bottom of the screen, then choose 'Sign out'.",
      'After signing out, you will return to the sign-in area.',
    ],
  },
]
