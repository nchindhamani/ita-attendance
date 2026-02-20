# API Testing Guide - Postman & cURL

This guide shows you how to test the Python FastAPI endpoints using Postman or cURL.

## Prerequisites

1. **Get your Vercel Preview URL**: 
   - Example: `https://ita-attendance-git-feat-b8c7de-chindhamani-nachiappans-projects.vercel.app`
   - Replace with your actual preview URL

2. **Get a JWT Token** (for authenticated endpoints):
   - Sign in to the frontend
   - Open browser DevTools (F12)
   - Go to Application/Storage → Cookies
   - Find the cookie named `sb-<project-ref>-auth-token` or similar
   - Copy the `access_token` value from the cookie (it's JSON, extract the token)
   - OR use the browser console method below

## Method 1: Get Token from Browser Console

1. Sign in to the frontend at your preview URL
2. Open browser console (F12 → Console tab)
3. Run this JavaScript:
   ```javascript
   // Get Supabase session
   const supabase = window.supabase || (await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2')).createClient(
     import.meta.env.VITE_SUPABASE_URL,
     import.meta.env.VITE_SUPABASE_ANON_KEY
   );
   
   const { data: { session } } = await supabase.auth.getSession();
   console.log('Access Token:', session?.access_token);
   ```
4. Copy the `access_token` value

## Endpoints

### 1. Health Check (No Auth Required)

**GET** `/api/`

#### cURL:
```bash
curl -X GET "https://ita-attendance-git-feat-b8c7de-chindhamani-nachiappans-projects.vercel.app/api/"
```

#### Postman:
- Method: `GET`
- URL: `https://ita-attendance-git-feat-b8c7de-chindhamani-nachiappans-projects.vercel.app/api/`
- No headers needed

**Expected Response:**
```json
{
  "status": "ok",
  "service": "ITA Attendance API"
}
```

---

### 2. Test Endpoint (No Auth Required)

**GET** `/api/test`

#### cURL:
```bash
curl -X GET "https://ita-attendance-git-feat-b8c7de-chindhamani-nachiappans-projects.vercel.app/api/test"
```

#### Postman:
- Method: `GET`
- URL: `https://ita-attendance-git-feat-b8c7de-chindhamani-nachiappans-projects.vercel.app/api/test`

**Expected Response:**
```json
{
  "status": "Python is alive",
  "message": "Backend connection successful"
}
```

---

### 3. Save Attendance (Auth Required)

**POST** `/api/attendance`

#### Headers Required:
```
Authorization: Bearer <your-jwt-token>
Content-Type: application/json
```

#### Request Body:
```json
{
  "sectionId": "section-uuid-here",
  "attendanceDate": "2025-02-18",
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
    },
    {
      "studentId": "student-uuid-3",
      "status": "late",
      "comments": "Arrived at 9:15 AM"
    }
  ]
}
```

#### cURL:
```bash
curl -X POST "https://ita-attendance-git-feat-b8c7de-chindhamani-nachiappans-projects.vercel.app/api/attendance" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "sectionId": "section-uuid-here",
    "attendanceDate": "2025-02-18",
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

#### Postman:
1. Method: `POST`
2. URL: `https://ita-attendance-git-feat-b8c7de-chindhamani-nachiappans-projects.vercel.app/api/attendance`
3. Headers:
   - `Authorization`: `Bearer YOUR_JWT_TOKEN_HERE`
   - `Content-Type`: `application/json`
4. Body (raw JSON):
   ```json
   {
     "sectionId": "section-uuid-here",
     "attendanceDate": "2025-02-18",
     "schoolYear": "2025-2026",
     "entries": [
       {
         "studentId": "student-uuid-1",
         "status": "present",
         "comments": null
       }
     ]
   }
   ```

**Expected Response (Success):**
```json
{
  "success": "Attendance saved."
}
```

**Expected Response (Error):**
```json
{
  "error": "Attendance is locked after 3:00 PM PT."
}
```
or
```json
{
  "error": "This date is marked as a holiday."
}
```

---

## Status Values

Valid `status` values for attendance entries:
- `"present"` - Student is present
- `"absent"` - Student is absent
- `"late"` - Student arrived late
- `"left_early"` - Student left early

---

## Common Errors

### 401 Unauthorized
- **Cause**: Missing or invalid JWT token
- **Fix**: Get a fresh token from the browser after signing in

### 403 Forbidden
- **Cause**: Account is deactivated or pending approval
- **Fix**: Ensure your profile is `is_active: true` and `is_approved: true` in the database

### 400 Bad Request
- **Cause**: Invalid request body or missing required fields
- **Fix**: Check that all required fields are present and valid

### 500 Internal Server Error
- **Cause**: Server-side error (database connection, missing env vars, etc.)
- **Fix**: Check Vercel logs for details

---

## Quick Test Script

Save this as `test-api.sh`:

```bash
#!/bin/bash

# Set your variables
BASE_URL="https://ita-attendance-git-feat-b8c7de-chindhamani-nachiappans-projects.vercel.app"
JWT_TOKEN="YOUR_JWT_TOKEN_HERE"

echo "Testing Health Check..."
curl -X GET "$BASE_URL/api/" | jq

echo -e "\n\nTesting /api/test..."
curl -X GET "$BASE_URL/api/test" | jq

echo -e "\n\nTesting /api/attendance (requires valid data)..."
curl -X POST "$BASE_URL/api/attendance" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sectionId": "your-section-id",
    "attendanceDate": "2025-02-18",
    "schoolYear": "2025-2026",
    "entries": []
  }' | jq
```

Make it executable: `chmod +x test-api.sh`
Run it: `./test-api.sh`

---

## Postman Collection Setup

1. Create a new Collection in Postman
2. Add environment variables:
   - `base_url`: Your Vercel preview URL
   - `jwt_token`: Your JWT token (update after each login)
3. Create requests for each endpoint
4. Use `{{base_url}}` and `{{jwt_token}}` in your requests

---

## Notes

- JWT tokens expire after a certain time (usually 1 hour for Supabase)
- You'll need to refresh your token by signing in again
- The `/api/attendance` endpoint has a daily cutoff (3:00 PM PT) - requests after that time will be rejected
- Dates must be in `YYYY-MM-DD` format
- All UUIDs must be valid Supabase UUIDs from your database

