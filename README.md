# ITA Attendance Portal

Production web application for the **International Tamil Academy (California)** that manages student, teacher, and volunteer attendance across regular classes and HSCP programs.

Built end-to-end as a full-stack product: role-based access, school-year data isolation, calendar-driven attendance, CSV bulk operations, and archival workflows — deployed to Vercel with Supabase as the data platform.

---

## Why this project matters

This is not a demo CRUD app. It solves real operational needs for a multi-role school organization:

- Different staff roles need different capabilities (record vs view, HSCP vs regular)
- Historical data must survive year-to-year reassignments (same teacher, new grade/section)
- Attendance dates must follow uploaded working-day calendars, not open-ended pickers
- Admins need bulk upload, classroom setup, and controlled archival — without losing auditability

---

## Highlights for reviewers

### Product & domain complexity
- **6 roles** with distinct UX and permissions: Admin, Principal, Attendance Officer, HSCP Officer, Teacher, Volunteer
- **Dual program support:** Regular grades + HSCP (Conversation / Reading / Writing)
- **School-year model (Aug–May, Pacific time)** as the source of truth for “current” operations
- **Year-scoped teacher assignments** so prior-year history is preserved when someone teaches a different class next year
- **Working-days allowlists** (HSCP vs Regular calendars) that drive date pickers and save rules across attendance flows

### Engineering depth
- **Vite + React + TypeScript** SPA with shared feature modules and role-specific pages
- **FastAPI backend** (Python) as a Vercel serverless API — auth-aware endpoints, bulk imports, classroom and working-days management
- **Supabase** for Postgres, Auth, RLS-aware patterns, and Storage (archives)
- **CSV pipelines** for students, classrooms, and working days (parse → validate → replace/insert with clear errors)
- **Operational SQL** for schema migrations and safe end-of-year staff deactivation (manual, cost-free)

### UX & reliability
- Custom calendar UI constrained to valid class days; clear messaging for future / non-working days
- Classroom management with guarded deletes (students block; attendance can be moved; teacher links confirmed)
- Audit fields on key tables (`created_by`, `last_updated_by`, timestamps) for backend traceability
- Inactivity logout, forced password reset, and `is_active` as a hard account kill-switch

---

## Core feature set

| Area | Capabilities |
|------|----------------|
| Auth & access | Email login, verification, approval queue, temporary passwords, role-based navigation |
| Attendance | Student & teacher attendance (Present / Absent / Late / Left Early + comments); volunteer/staff attendance |
| Calendars | Working-days upload; date pickers limited to uploaded class days |
| Classrooms | Create/list/edit room; HSCP trio creation; safe delete with attendance move |
| Staff | Staff directory, reassignment for current year, HSCP officer reassignment for HSCP teachers only |
| Students | Manual add + CSV; section required for regular grades; HSCP multi-section handling |
| Governance | Two-stage archive/purge; end-of-year deactivate script (everyone except Admin & HSCP Officer) |

---

## Architecture

```
┌─────────────────┐     /api/*      ┌──────────────────┐
│  React (Vite)   │ ───────────────► │  FastAPI (Vercel) │
│  Role-based UI  │                  │  Business logic   │
└────────┬────────┘                  └────────┬─────────┘
         │                                    │
         │         Supabase JS / service role │
         └────────────────┬───────────────────┘
                          ▼
                 ┌─────────────────┐
                 │ Supabase        │
                 │ Postgres · Auth │
                 │ Storage         │
                 └─────────────────┘
```

**Local defaults:** frontend `http://localhost:3003` (proxies `/api` → API on `8002`).

---

## Tech stack

- **Frontend:** React 18, Vite, React Router, TypeScript, Tailwind CSS, Radix/Shadcn-style UI
- **Backend:** FastAPI (`api/index.py`)
- **Platform:** Supabase (PostgreSQL, Auth, Storage), Vercel

---

## Local setup (optional)

```bash
npm install
# Create .env.local with VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET
npm run dev:all
```

Apply SQL under `supabase/` (schema + migrations) in your Supabase project as needed.

---

## Repository notes

- Internal documentation under `/docs` is gitignored and not published with this repo.
- Secrets live in `.env.local` / host env vars — never committed.
