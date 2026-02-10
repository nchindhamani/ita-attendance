# Vercel Python Detection Issue

## Current Status
- ✅ Files are in Source tab (`api/` directory exists)
- ❌ Files are NOT in Resources tab (not detected as serverless functions)
- ❌ `/api` and `/api/index` return 404

## Why This Happens

Vercel needs to **detect** Python files during the build process. If they're in Source but not Resources, it means:
1. Files are being deployed ✅
2. But Vercel isn't recognizing them as serverless functions ❌

## Requirements for Vercel Python Detection

For Vercel to detect Python functions, you need:

1. **File Location**: `api/index.py` (or `api/*.py`)
2. **FastAPI App Variable**: Must have `app = FastAPI(...)` at module level
3. **Requirements.txt**: Must be at project root
4. **Handler Function**: For custom handlers, need `def handler(request)`

## Current Setup

- ✅ `api/index.py` exists
- ✅ `app = FastAPI(...)` is defined
- ✅ `requirements.txt` at root
- ✅ `handler(request)` function exists

## Possible Issues

1. **Build Process**: Vercel might not be scanning for Python during Next.js build
2. **File Format**: Handler format might not match Vercel's expectations
3. **Dependencies**: Python dependencies might not be installing

## Next Steps

1. Check build logs for Python-related messages
2. Verify `requirements.txt` format is correct
3. Test if simpler `api/hello.py` is detected
4. Check if Vercel project needs Python runtime enabled

## Testing

After next deployment, check:
- Resources tab: Should show `api/index.py` and `api/hello.py`
- Test `/api/hello` - should work if detection succeeds
- Test `/api/index` - should work if detection succeeds

