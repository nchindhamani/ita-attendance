# ITA Attendance Portal

Web application for the International Tamil Academy (California) to manage student, teacher, and staff attendance across regular and HSCP programs.

## Core Features

- **Roles:** Admin, Principal, Attendance Officer, HSCP Officer, Teacher, Volunteer
- **Authentication:** Email login, verification, admin approval, temporary passwords / forced reset
- **Master switch:** `profiles.is_active` blocks login and session use
- **School year:** August–May (America/Los_Angeles); current year is derived from that calendar
- **Working days:** Uploaded calendars (HSCP vs Regular) drive attendance date pickers
- **Classroom management:** Grade / section / room for the current school year; HSCP creates Conversation, Reading, Writing together
- **Teacher assignments:** Year-scoped via `teacher_sections` → `sections` (prior years preserved on reassignment)
- **Attendance:** Present, Absent, Late, Left Early + comments for students and teachers; volunteer/other staff attendance for admins/principals
- **Rosters:** Manual add and CSV upload
- **Archive:** Two-stage archive/purge of student data by school year (Supabase Storage)
- **Staff lifecycle:** Deactivate accounts in-app; optional end-of-year SQL script to deactivate non-admin / non-HSCP-officer staff one month after the last working day

## Tech Stack

| Layer | Technology |
|--------|------------|
| Frontend | React 18, Vite, React Router, TypeScript, Tailwind CSS, Shadcn-style UI |
| API | FastAPI (`api/index.py`), deployed as a Vercel serverless function |
| Data / Auth | Supabase (PostgreSQL, Auth, Storage) |
| Deployment | Vercel |

## Project layout (high level)

- `src/` — React app (pages, features, components)
- `api/index.py` — FastAPI backend
- `supabase/` — schema, migrations, and operational SQL scripts
- `scripts/` — local dev helpers (`dev.sh`, `dev-api.sh`, etc.)

## Setup

### 1. Supabase

1. Create a Supabase project.
2. Apply schema / migrations under `supabase/` (start from `supabase/schema.sql` and apply later migrations as needed, including working days and audit columns).
3. Create a storage bucket named `ITA_attendance_archives` if you use archive features.

### 2. Environment

Create `.env.local` in the project root:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_JWT_SECRET=...          # from Supabase project settings (JWT secret)
VITE_SITE_URL=http://localhost:3003
```

Do not commit `.env.local` (it is gitignored).

### 3. Install & run locally

```bash
npm install
npm run dev:all
```

- Frontend: [http://localhost:3003](http://localhost:3003) (Vite proxies `/api` → the API)
- API: [http://localhost:8002](http://localhost:8002)

Or run separately:

```bash
npm run dev        # frontend only
npm run dev:api    # FastAPI only
```

Python API dependencies are managed by the API start script (see `scripts/dev-api.sh`).

### 4. Useful SQL scripts

| Script | Purpose |
|--------|---------|
| `supabase/migrations/` | Schema evolution |
| `supabase/create_working_days.sql` | Working days table |
| `supabase/deactivate_staff_after_school_year.sql` | Manual end-of-year staff deactivation (preview + update) |

## Notes for contributors

- Teacher grade/section for a given year comes from **classroom assignment** (`teacher_sections` → `sections.school_year`), not only from `profiles.grade`.
- Internal docs under `/docs` are gitignored and are not part of the public repo.
- Prefer `npm run dev:all` so the UI and API stay in sync during local development.
