# Password Reset Fix

## Problem
Password reset links were not working because the callback handler wasn't properly reading hash fragments from the URL.

## Fixes Applied

### 1. Fixed AuthCallbackPage (`src/pages/auth/AuthCallbackPage.tsx`)
- Changed from `location.hash` (React Router doesn't track hash) to `window.location.hash`
- Added better error handling and logging
- Fixed dependency array to not rely on `location.hash`

### 2. Added Admin Password Reset Endpoint (`POST /api/admin/reset-password`)
- Admin-only endpoint to reset any user's password
- Requires admin authentication
- Uses Supabase Admin API to update password

## How to Reset Password for shoppingbuddy8@gmail.com

### Option 1: Use Python Script (Easiest - Direct Password Reset)

**This is the fastest way to reset a password without email flow.**

1. Make sure you have `.env.local` in the project root with:
   - `VITE_SUPABASE_URL` (or `SUPABASE_URL`)
   - `SUPABASE_SERVICE_ROLE_KEY`

2. Run the script:
   ```bash
   python scripts/reset_password.py shoppingbuddy8@gmail.com YourNewPassword123
   ```

3. The script will:
   - Find the user by email
   - Update the password directly
   - Confirm success

**Example:**
```bash
cd /Users/chindhamani/development/ITA_Attendance_Management_App/ITA_Attendance_Mgmt_App_Codebase
python scripts/reset_password.py shoppingbuddy8@gmail.com MyNewPassword123
```

### Option 2: Use Supabase Dashboard (Send Recovery Email Only)

**Note:** Supabase Dashboard only allows sending recovery emails, not direct password updates.

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Authentication** → **Users**
4. Search for `shoppingbuddy8@gmail.com`
5. Click on the user
6. Click **Send password recovery** (this sends an email, doesn't directly update password)

### Option 2: Use Admin Password Reset API (If You Have Another Admin Account)

If you have access to another admin account:

1. Log in as that admin
2. Make a POST request to `/api/admin/reset-password`:

```bash
curl -X POST https://ita-attendance.vercel.app/api/admin/reset-password \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "shoppingbuddy8@gmail.com",
    "new_password": "your_new_password_here"
  }'
```

### Option 3: Test Password Reset Link (After Fix)

1. Go to `/auth/reset`
2. Enter `shoppingbuddy8@gmail.com`
3. Check email for reset link
4. Click the link - it should now work correctly
5. The link will redirect to `/auth/callback` which processes the hash fragments
6. Then redirects to `/auth/update-password` where you can set a new password

## Supabase Redirect URL Configuration

Make sure your Supabase project has the correct redirect URLs configured:

1. Go to Supabase Dashboard → **Authentication** → **URL Configuration**
2. Add these to **Redirect URLs**:
   - `https://ita-attendance.vercel.app/auth/callback`
   - `https://ita-attendance.vercel.app/*`
   - `http://localhost:3002/auth/callback` (for local development)

## Testing the Fix

1. **Test Password Reset Flow:**
   - Go to `/auth/reset`
   - Enter an email
   - Check email for reset link
   - Click the link
   - Should redirect to `/auth/callback` → `/auth/update-password`
   - Set new password
   - Should redirect to `/auth/login`

2. **Test Admin Password Reset (if you have admin access):**
   - Log in as admin
   - Use the API endpoint to reset a user's password
   - Verify the user can log in with the new password

## Troubleshooting

### If password reset links still don't work:

1. **Check Supabase Email Settings:**
   - Go to Supabase Dashboard → **Authentication** → **Email Templates**
   - Verify "Reset Password" template is enabled
   - Check that email sending is configured

2. **Check Redirect URLs:**
   - Make sure `https://ita-attendance.vercel.app/auth/callback` is in the allowed redirect URLs

3. **Check Browser Console:**
   - Open browser DevTools → Console
   - Look for errors when clicking the reset link
   - Check Network tab to see if requests are being made

4. **Check Vercel Logs:**
   - Go to Vercel Dashboard → Your Project → Logs
   - Look for errors in the `/api` endpoints

## Quick Fix Script (Python)

If you have access to the Supabase service role key, you can run this Python script:

```python
import os
import httpx

SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
EMAIL = "shoppingbuddy8@gmail.com"
NEW_PASSWORD = "your_new_password_here"

# Find user by email
auth_url = f"{SUPABASE_URL}/auth/v1/admin/users"
headers = {
    "apikey": SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
}

# List users to find the one with matching email
response = httpx.get(auth_url, headers=headers, params={"email": EMAIL})
users = response.json()

if users and len(users) > 0:
    user_id = users[0]["id"]
    
    # Update password
    update_url = f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}"
    update_response = httpx.put(
        update_url,
        headers=headers,
        json={"password": NEW_PASSWORD}
    )
    
    if update_response.status_code in [200, 201]:
        print(f"✅ Password reset successful for {EMAIL}")
    else:
        print(f"❌ Error: {update_response.text}")
else:
    print(f"❌ User not found: {EMAIL}")
```

