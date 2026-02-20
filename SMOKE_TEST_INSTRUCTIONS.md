# Smoke Test Instructions

## Purpose
Verify that the Vite frontend can successfully communicate with the Python backend before continuing with the full migration.

## Test 1: Python API Connection

**What to check:**
1. Open your Vercel Preview URL
2. Open browser DevTools (F12) → Console tab
3. Look for: `✅ Python API Test: {status: "Python is alive", message: "Backend connection successful"}`

**Expected Result:**
- ✅ Success: You see the success message with the Python response
- ❌ Failure: You see an error like "Failed to fetch" or "404 Not Found"

**If it fails:**
- Check Vercel deployment logs for Python function errors
- Verify `vercel.json` rewrite is correct
- Check that `api/index.py` is being detected as a serverless function

## Test 2: Environment Variables

**What to check:**
1. In the same browser console, look for:
   ```
   🔑 Environment Variables Check:
   VITE_SUPABASE_URL: ✅ Set (or ❌ Missing)
   VITE_SUPABASE_ANON_KEY: ✅ Set (or ❌ Missing)
   Full URL: [your-supabase-url]
   ```

**Expected Result:**
- ✅ Success: Both variables show "✅ Set" and the URL is displayed
- ❌ Failure: Variables show "❌ Missing"

**If it fails:**
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add/Update:
   - `VITE_SUPABASE_URL` (rename from `NEXT_PUBLIC_SUPABASE_URL` if it exists)
   - `VITE_SUPABASE_ANON_KEY` (rename from `NEXT_PUBLIC_SUPABASE_ANON_KEY` if it exists)
3. Redeploy after adding variables

## What to Report

After running both tests, report:
1. ✅ or ❌ for Test 1 (Python API)
2. ✅ or ❌ for Test 2 (Environment Variables)
3. Any error messages you see in the console
4. Screenshot of console output (if possible)

## Next Steps

**If both tests pass:**
- ✅ Foundation is solid! We can proceed with converting all pages
- The bridge between Vite and Python is working

**If either test fails:**
- ❌ We need to fix the foundation first
- Don't proceed with page conversion until these work
- Share the error details and we'll troubleshoot


