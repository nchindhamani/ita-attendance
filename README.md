# ITA Attendance Portal

A specialized web application designed for the International Tamil Academy (California) to streamline student attendance tracking.

## Core Features
- **Secure Authentication:** Email-based login, email verification, and admin approval for new teachers.
- **Master Switch:** `is_active` blocks login, resets, and forces logout.
- **Attendance Tracking:** Present, Absent, Late, Left Early + comments. 3:00 PM PT cutoff.
- **Class Management:** Multi-teacher sections, manual roster entry, and CSV uploads.
- **Data Governance:** Two-stage archive to Supabase Storage with verification + purge.
- **Deactivation:** One-click account suspension for staff who leave the academy.

## Tech Stack
- **Frontend:** Next.js 14 (App Router), Tailwind CSS, Shadcn/UI
- **Backend/Database:** Supabase (PostgreSQL, Auth, and Storage)
- **Deployment:** Vercel

## Setup
1. Create a Supabase project and apply the SQL in `supabase/schema.sql`.
2. Create a storage bucket named `ITA_attendance_archives`.
3. Configure `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SITE_URL` (e.g. `http://localhost:3000`)
4. Install dependencies with `npm install`.
5. Start the dev server with `npm run dev`.
