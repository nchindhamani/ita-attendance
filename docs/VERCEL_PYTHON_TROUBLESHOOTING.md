# Vercel Python Function Troubleshooting

> **Note:** This is a quick reference guide. For comprehensive migration details, see [VERCEL_PYTHON_MIGRATION.md](./VERCEL_PYTHON_MIGRATION.md).

## Quick Troubleshooting Checklist

If Python functions aren't working, check these in order:

### ✅ Basic Requirements
- [ ] `/api/` folder exists at **root level** (not `/src/api/` or `/python-api/`)
- [ ] `app = FastAPI()` is at **module level** in `api/index.py`
- [ ] `requirements.txt` exists at **root level**
- [ ] No custom `handler` function or `Mangum` adapter
- [ ] `vercel.json` has `framework: null` (prevents Next.js detection)

### ✅ Vercel Configuration
- [ ] No `functions` block in `vercel.json` (let Vercel auto-detect)
- [ ] No explicit `runtime` in `vercel.json` (let Vercel auto-detect)
- [ ] Rewrite destination is `/api/index` (not `/api/index.py`)
- [ ] Next.js config files renamed/removed (if migrated to Vite)

### ✅ Deployment Verification

**1. Check Resources Tab:**
- Go to Vercel Dashboard → Deployment → Resources
- Should see `api/index.py` listed as a serverless function
- If missing, Python detection failed

**2. Check Build Logs:**
Look for these messages:
- ✅ "Detected Python runtime"
- ✅ "Installing Python dependencies from requirements.txt"
- ✅ "Creating serverless function: api/index.py"
- ❌ If you see "Detected Next.js" instead, Next.js is interfering

**3. Test Endpoints:**
- `GET /api/test` → Should return JSON: `{"status": "Python is alive", ...}`
- `GET /api/` → Should return JSON: `{"status": "ok", "service": "ITA Attendance API"}`
- If you get HTML or 404, routing is broken

## Common Issues & Solutions

### Issue 1: Functions Not Detected
**Symptoms:** No Python functions in Resources tab, 404 errors

**Solutions:**
1. Verify `/api/` is at root (not nested)
2. Ensure `app = FastAPI()` at module level
3. Check `requirements.txt` exists at root
4. Remove any `functions` block from `vercel.json`
5. Ensure Next.js detection is disabled

### Issue 2: Next.js Conflicts
**Symptoms:** Build logs show Next.js, no Python detection

**Solutions:**
1. Rename `next.config.mjs` → `next.config.mjs.bak`
2. Set `framework: null` in `vercel.json`
3. Remove Next.js-specific files from build

### Issue 3: Routing Issues
**Symptoms:** `/api/*` returns HTML or 404

**Solutions:**
1. Check `vercel.json` rewrites:
   ```json
   {
     "rewrites": [
       {
         "source": "/api/(.*)",
         "destination": "/api/index"
       }
     ]
   }
   ```
2. Verify destination is `/api/index` (no `.py` extension)
3. Check if frontend is intercepting `/api` routes

### Issue 4: RLS Policy Errors
**Symptoms:** "Supabase returned None" errors

**Solutions:**
1. Run RLS policy migration: `supabase/migrations/013_add_profiles_rls_policy.sql`
2. Verify JWT token is passed to Supabase client
3. Check if admin client is used for operations that bypass RLS

## Debugging Steps

1. **Check Build Output:**
   ```bash
   # In Vercel build logs, look for:
   - "Detected Python runtime"
   - "Installing dependencies from requirements.txt"
   - "api/index.py" in function list
   ```

2. **Check Function Logs:**
   - Go to Deployment → Logs
   - Filter by `/api/*` requests
   - Look for Python function invocations
   - Check for error messages

3. **Test Directly:**
   ```bash
   # Test health endpoint
   curl https://your-deployment.vercel.app/api/test
   
   # Should return:
   # {"status": "Python is alive", "message": "Backend connection successful"}
   ```

4. **Verify File Structure:**
   ```
   /
   ├── api/
   │   └── index.py    ← Must be here, not in src/
   ├── requirements.txt ← Must be at root
   └── vercel.json
   ```

## Still Not Working?

1. **Check the comprehensive guide:** [VERCEL_PYTHON_MIGRATION.md](./VERCEL_PYTHON_MIGRATION.md)
2. **Verify all requirements** from the checklist above
3. **Check Vercel deployment logs** for specific errors
4. **Test with a minimal FastAPI app** to isolate the issue

## Reference

- **Full Migration Guide:** [VERCEL_PYTHON_MIGRATION.md](./VERCEL_PYTHON_MIGRATION.md)
- **Detection Guide:** [VERCEL_PYTHON_DETECTION.md](./VERCEL_PYTHON_DETECTION.md)
- **API Testing:** [API_TESTING_GUIDE.md](./API_TESTING_GUIDE.md)

