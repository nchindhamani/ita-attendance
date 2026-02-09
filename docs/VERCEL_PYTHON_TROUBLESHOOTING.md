# Vercel Python Function Troubleshooting

## Current Issue
- `/api` and `/api/index` return 404
- Build logs show no Python detection
- Files are committed: `api/index.py`, `api/hello.py`
- `requirements.txt` exists in root

## How to Check if Python Functions are Deployed

### 1. Check Deployment Functions List
1. Go to Vercel Dashboard → Your Deployment
2. Click on the deployment
3. Look for a "Functions" tab or section
4. Check if you see:
   - `api/index.py` listed
   - `api/hello.py` listed
   - Any Python functions

### 2. Check Build Logs for Python
Look for these messages in build logs:
- "Detected Python runtime"
- "Installing Python dependencies"
- "Creating Python function: api/index.py"
- Any errors about Python

### 3. Check Function Logs
1. Go to Deployment → Functions tab
2. Look for runtime errors
3. Check if functions are listed at all

## Possible Issues

### Issue 1: Vercel Not Detecting Python
**Symptoms:** No Python in build logs, 404 errors
**Solution:** 
- Verify `requirements.txt` is in root directory
- Check if files are actually in the deployment
- Try accessing `/api/hello` (simpler test)

### Issue 2: Next.js Conflict
**Symptoms:** Next.js might be intercepting `/api` routes
**Solution:**
- Check `next.config.mjs` rewrites
- Verify `vercel.json` rewrites are correct
- Try accessing function directly: `/api/hello` (no rewrite)

### Issue 3: Python Runtime Not Available
**Symptoms:** Functions listed but errors when called
**Solution:**
- Check Vercel project plan (Hobby/Pro)
- Verify Python runtime is supported
- Check function logs for errors

## Next Steps

1. **Check Deployment Functions Tab**
   - See if Python functions are listed
   - Share what you see

2. **Test `/api/hello` After Deployment**
   - This is a simpler function
   - If this works, detection is working
   - If 404, detection is the issue

3. **Check Build Output**
   - Look for "api/" in build output
   - Check if Python files are being processed

4. **Share Results**
   - What you see in Functions tab
   - Result of `/api/hello` test
   - Any errors in function logs

