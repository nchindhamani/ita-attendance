# Next.js to Vite + React Migration Progress

## ✅ Completed

1. **Vite Configuration**
   - Created `vite.config.ts` with React plugin and path aliases
   - Created `index.html` entry point
   - Updated `package.json` with Vite dependencies and scripts
   - Removed Next.js dependencies

2. **React Router Setup**
   - Created `src/main.tsx` entry point
   - Created `src/App.tsx` with route definitions
   - Updated `tailwind.config.ts` for Vite content paths

3. **Layouts**
   - Created `src/layouts/AuthLayout.tsx`
   - Created `src/layouts/DashboardLayout.tsx` with client-side auth hooks

4. **Navigation Components**
   - Updated `Sidebar.tsx` to use react-router-dom
   - Updated `BottomNav.tsx` to use react-router-dom
   - Updated `NavLink.tsx` to use react-router-dom

5. **Client-Side Auth**
   - Created `src/lib/auth-client.ts` with React hooks
   - Updated `src/lib/supabase/client.ts` to use `VITE_` env vars

6. **Vercel Configuration**
   - Updated `vercel.json` to route `/api/*` to `api/index.py`
   - Added SPA routing: `/*` to `index.html`

7. **Environment Variables**
   - Updated `api/index.py` to use `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   - Updated `src/lib/supabase/client.ts` to use `import.meta.env.VITE_*`

8. **Pages Created**
   - `src/pages/HomePage.tsx`
   - `src/pages/auth/LoginPage.tsx`

## 🔄 In Progress / TODO

### Pages to Convert (25 remaining)

All pages in `src/app/` need to be converted to `src/pages/`:

**Auth Pages:**
- [ ] `src/pages/auth/SignupPage.tsx`
- [ ] `src/pages/auth/SignupAdminPage.tsx`
- [ ] `src/pages/auth/SignupTeacherPage.tsx`
- [ ] `src/pages/auth/ResetPasswordPage.tsx`
- [ ] `src/pages/auth/UpdatePasswordPage.tsx`
- [ ] `src/pages/auth/VerifyEmailPage.tsx`
- [ ] `src/pages/auth/PendingApprovalPage.tsx`

**Dashboard Pages:**
- [ ] `src/pages/dashboard/DashboardPage.tsx`
- [ ] `src/pages/dashboard/AttendancePage.tsx`
- [ ] `src/pages/dashboard/HistoryPage.tsx`
- [ ] `src/pages/dashboard/ProfilePage.tsx`

**Teacher Pages:**
- [ ] `src/pages/teacher/TeacherPage.tsx`
- [ ] `src/pages/teacher/TeacherStudentAttendancePage.tsx`

**Admin Pages:**
- [ ] `src/pages/admin/AdminPage.tsx`
- [ ] `src/pages/admin/AdminUsersPage.tsx`
- [ ] `src/pages/admin/AdminUserDetailPage.tsx`
- [ ] `src/pages/admin/AdminAttendancePage.tsx`
- [ ] `src/pages/admin/AdminStudentAttendancePage.tsx`
- [ ] `src/pages/admin/AdminArchivePage.tsx`

**Other Pages:**
- [ ] `src/pages/AccountDisabledPage.tsx`
- [ ] `src/pages/PendingPage.tsx`

### Environment Variables to Update

Files still using `NEXT_PUBLIC_`:
- [ ] `src/lib/supabase/server.ts` (may need to be removed/refactored)
- [ ] `src/lib/supabase/admin.ts`
- [ ] `src/app/(auth)/auth/actions.ts` (needs conversion to client-side)
- [ ] `src/app/auth/callback/route.ts` (needs conversion)
- [ ] `src/app/debug/profile/page.tsx`
- [ ] `middleware.ts` (can be removed - handled by client-side auth hooks)

### Server Actions to Convert

All Next.js Server Actions need to be converted to:
1. Client-side API calls to `/api/*` endpoints, OR
2. Direct Supabase client calls

Files with Server Actions:
- [ ] `src/app/(auth)/auth/actions.ts`
- [ ] `src/app/(dashboard)/attendance/actions.ts`
- [ ] `src/app/(dashboard)/profile/actions.ts`
- [ ] `src/app/(dashboard)/admin/users/actions.ts`
- [ ] `src/app/(dashboard)/admin/archive/actions.ts`

### Features to Update

Check all feature components for:
- [ ] `Link` from `next/link` → `Link` from `react-router-dom`
- [ ] `usePathname` → `useLocation` from `react-router-dom`
- [ ] `redirect` from `next/navigation` → `useNavigate` from `react-router-dom`
- [ ] Server Actions → Client-side API calls

### Files to Remove

- [ ] `middleware.ts` (Next.js middleware - not needed)
- [ ] `next.config.mjs`
- [ ] `next-env.d.ts`
- [ ] All `src/app/` directory (after pages are migrated)

## Conversion Pattern

### Page Conversion Example

**Before (Next.js):**
```tsx
import Link from "next/link";
import { requireActiveProfile } from "@/lib/auth";

export default async function MyPage() {
  const profile = await requireActiveProfile();
  return <div>...</div>;
}
```

**After (Vite + React):**
```tsx
import { useRequireActiveProfile } from "@/lib/auth-client";

export default function MyPage() {
  const { profile, loading } = useRequireActiveProfile();
  if (loading) return <div>Loading...</div>;
  return <div>...</div>;
}
```

### Link Conversion

**Before:**
```tsx
import Link from "next/link";
<Link href="/path">Text</Link>
```

**After:**
```tsx
import { Link } from "react-router-dom";
<Link to="/path">Text</Link>
```

### Server Action Conversion

**Before:**
```tsx
import { useFormState } from "react-dom";
import { serverAction } from "./actions";

const [state, formAction] = useFormState(serverAction, initialState);
<form action={formAction}>...</form>
```

**After:**
```tsx
import { useState } from "react";

const [error, setError] = useState<string | null>(null);
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  try {
    const response = await fetch('/api/endpoint', { method: 'POST', ... });
    // handle response
  } catch (err) {
    setError(err.message);
  }
};
<form onSubmit={handleSubmit}>...</form>
```

## Next Steps

1. Convert remaining pages following the pattern above
2. Convert all Server Actions to client-side API calls
3. Update all environment variable references
4. Remove Next.js-specific files
5. Test all routes and functionality
6. Update any remaining imports

