# ITA Attendance Portal

A specialized web application designed for the International Tamil Academy (California) to streamline student attendance tracking.

### Core Features
- **Secure Authentication:** Email-based login with mandatory admin approval for new teachers.
- **Attendance Tracking:** Support for Present, Absent, Late, and Leaving Early statuses with a 3:00 PM PT daily edit cutoff.
- **Class Management:** Multi-teacher support for shared sections and manual/CSV student imports.
- **Data Governance:** Two-stage verification for school-year archiving and data purging.
- **Deactivation:** One-click account suspension for staff who leave the academy.

### Tech Stack
- **Frontend:** Next.js 14 (App Router), Tailwind CSS, Shadcn/UI
- **Backend/Database:** Supabase (PostgreSQL, Auth, and Storage)
- **Deployment:** Vercel