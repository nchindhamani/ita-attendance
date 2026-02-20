# Python API Testing Guide

## Testing the Python FastAPI Backend

### 1. Get Your Preview URL
Your Vercel preview deployment URL will be something like:
```
https://ita-attendance-git-feature-python-backend-migration-{your-org}.vercel.app
```

### 2. Test Health Check Endpoint

```bash
curl https://your-preview-url.vercel.app/api/
```

Expected response:
```json
{"status": "ok", "service": "ITA Attendance API"}
```

### 3. Get JWT Token for Authentication

You need a valid Supabase JWT token. You can get this by:

**Option A: From Browser DevTools**
1. Log into your app in the browser
2. Open DevTools → Application/Storage → Cookies
3. Find the Supabase auth cookie (usually `sb-<project-id>-auth-token`)
4. Extract the JWT token from the cookie value

**Option B: From Supabase Dashboard**
1. Go to Supabase Dashboard → Authentication → Users
2. Create a test user or use existing user
3. Use Supabase Auth API to get token

**Option C: Programmatically (for testing)**
```typescript
// In browser console after logging in
const { data: { session } } = await supabase.auth.getSession();
console.log(session?.access_token); // This is your JWT token
```

### 4. Test Attendance Endpoint

```bash
curl -X POST https://your-preview-url.vercel.app/api/attendance \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -d '{
    "sectionId": "your-section-id",
    "attendanceDate": "2025-01-15",
    "schoolYear": "2025-2026",
    "entries": [
      {
        "studentId": "student-uuid-1",
        "status": "present",
        "comments": null
      },
      {
        "studentId": "student-uuid-2",
        "status": "absent",
        "comments": "Sick"
      }
    ]
  }'
```

### 5. Expected Responses

**Success:**
```json
{
  "success": "Attendance saved."
}
```

**Error Examples:**
```json
{
  "error": "Attendance is locked after 3:00 PM PT."
}
```

```json
{
  "error": "This date is marked as a holiday."
}
```

```json
{
  "error": "Authorization header missing"
}
```

### 6. Test from Frontend (Optional)

You can create a test component to call the Python API:

```typescript
// Test component
async function testPythonAPI() {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    console.error("Not authenticated");
    return;
  }
  
  const response = await fetch("/api/attendance", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      sectionId: "your-section-id",
      attendanceDate: "2025-01-15",
      schoolYear: "2025-2026",
      entries: [
        {
          studentId: "student-uuid",
          status: "present",
          comments: null,
        },
      ],
    }),
  });
  
  const result = await response.json();
  console.log(result);
}
```

## Troubleshooting

### Error: "Supabase configuration missing"
- Check that `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set in Vercel

### Error: "JWT secret not configured"
- Add `SUPABASE_JWT_SECRET` to Vercel environment variables
- Get it from Supabase Dashboard → Project Settings → API → JWT Secret

### Error: "Invalid token"
- Make sure you're using a valid, non-expired JWT token
- Token should be from Supabase Auth (not a custom token)

### Error: "Profile not found"
- User must exist in the `profiles` table
- User must be approved (`is_approved: true`)
- User must be active (`is_active: true`)

## Next Steps

1. ✅ Test the endpoint works
2. Update frontend to optionally use Python API (hybrid mode)
3. Migrate more Server Actions to Python
4. Gradually switch frontend to use Python endpoints


