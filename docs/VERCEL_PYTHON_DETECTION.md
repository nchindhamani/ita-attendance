# Vercel Python Function Detection Guide

> **Note:** This is a quick reference for detection issues. For comprehensive migration details, see [VERCEL_PYTHON_MIGRATION.md](./VERCEL_PYTHON_MIGRATION.md).

## How Vercel Detects Python Functions

Vercel automatically detects Python serverless functions by:

1. **Scanning `/api/` directory** at the root level
2. **Looking for Python files** (`.py` extension)
3. **Checking for FastAPI app** - looks for `app = FastAPI()` at module level
4. **Reading dependencies** from `requirements.txt` or `pyproject.toml`
5. **Auto-generating serverless function** for each Python file
6. **Using Python 3.12** by default (latest supported)

## Critical Requirements for Detection

### ✅ Must Have

1. **Folder Location:** `/api/` at **root level** (not `/src/api/` or `/python-api/`)
2. **Module-Level App:** `app = FastAPI()` must be at module level in `index.py`
3. **Requirements.txt:** Must exist at **root level** (not in `/api/`)
4. **No Custom Handler:** Don't use `Mangum` or custom `handler` functions
5. **No Functions Block:** Don't define `functions` in `vercel.json` (let Vercel auto-detect)

### ❌ Must NOT Have

1. **Custom Handler Function:** Breaks auto-detection
2. **Mangum Adapter:** Interferes with detection
3. **Functions Block in vercel.json:** Can prevent auto-detection
4. **Explicit Runtime:** Let Vercel auto-detect version
5. **Nested API Folder:** Must be at root, not in `/src/`

## Detection Checklist

If functions aren't detected, verify:

- [ ] `/api/` folder exists at root (check with `ls -la api/`)
- [ ] `api/index.py` contains `app = FastAPI()` at module level
- [ ] `requirements.txt` exists at root (same level as `package.json`)
- [ ] No `handler` function in `index.py`
- [ ] No `Mangum` import or usage
- [ ] `vercel.json` has no `functions` block
- [ ] Next.js detection is disabled (`framework: null`)

## Verification Steps

### 1. Check Build Logs

Look for these messages in Vercel build logs:

```
✅ "Detected Python runtime"
✅ "Installing Python dependencies from requirements.txt"
✅ "Creating serverless function: api/index.py"
```

If you see:
```
❌ "Detected Next.js" (without Python)
❌ No Python-related messages
```

Then detection failed.

### 2. Check Resources Tab

1. Go to **Vercel Dashboard → Deployment → Resources**
2. Should see:
   - ✅ `api/index.py` listed as a serverless function
   - ✅ Runtime: Python 3.12
   - ✅ Status: Ready

If missing:
- ❌ Detection failed
- Check the checklist above
- Review build logs for errors

### 3. Check Sources vs Resources

- **Sources Tab:** Shows all files in deployment (including Python files)
- **Resources Tab:** Shows detected serverless functions

**If files are in Sources but NOT in Resources:**
- Detection failed
- Python files are deployed but not recognized as functions
- Check requirements above

## Common Detection Failures

### Failure 1: Files in Sources, Not in Resources

**Cause:** Detection requirements not met

**Solution:**
1. Verify `app = FastAPI()` is at module level
2. Check `requirements.txt` is at root
3. Remove any custom handlers
4. Ensure `/api/` is at root level

### Failure 2: Next.js Detected Instead

**Cause:** Next.js framework detection overriding Python

**Solution:**
1. Rename `next.config.mjs` → `next.config.mjs.bak`
2. Set `framework: null` in `vercel.json`
3. Remove Next.js-specific files

### Failure 3: No Python in Build Logs

**Cause:** Vercel not scanning for Python

**Solution:**
1. Verify `requirements.txt` format is correct
2. Check file is actually committed to git
3. Ensure `/api/` folder structure is correct

## Testing Detection

After deployment:

1. **Check Resources Tab:**
   - Should see `api/index.py` listed

2. **Test Endpoint:**
   ```bash
   curl https://your-deployment.vercel.app/api/test
   ```
   - Should return: `{"status": "Python is alive", ...}`
   - If 404, detection failed

3. **Check Function Logs:**
   - Go to Deployment → Logs
   - Filter by `/api/*`
   - Should see Python function invocations

## Reference

- **Full Migration Guide:** [VERCEL_PYTHON_MIGRATION.md](./VERCEL_PYTHON_MIGRATION.md)
- **Troubleshooting:** [VERCEL_PYTHON_TROUBLESHOOTING.md](./VERCEL_PYTHON_TROUBLESHOOTING.md)
- **API Testing:** [API_TESTING_GUIDE.md](./API_TESTING_GUIDE.md)

## Quick Fix Summary

If detection isn't working, the most common fixes are:

1. **Move `/api/` to root** (if nested)
2. **Ensure `app = FastAPI()` at module level**
3. **Add `requirements.txt` at root**
4. **Remove custom handlers/Mangum**
5. **Disable Next.js detection**
6. **Remove `functions` block from `vercel.json`**

