# Local Development Guide

This guide explains how to run the ITA Attendance Portal locally for development and testing before deploying to Vercel.

## Why Test Locally First?

✅ **Faster feedback loop** - See changes instantly without waiting for Vercel deployments  
✅ **Save time** - Catch errors immediately instead of waiting 2-5 minutes per deployment  
✅ **Better debugging** - Full access to logs and error messages  
✅ **Cost efficient** - No unnecessary Vercel build minutes  
✅ **Offline development** - Work without internet (except for Supabase calls)

## Prerequisites

1. **Node.js 18+** - For frontend (Vite + React)
2. **Python 3.12+** - For backend (FastAPI)
3. **uv** - Fast Python package manager ([Install Guide](https://github.com/astral-sh/uv))
4. **Supabase Project** - Your production Supabase instance (we use the same DB)

## Quick Start

### Option 1: Run Everything Together (Recommended)

```bash
npm run dev:all
```

This starts both frontend (port 3000) and backend (port 8000) automatically.

### Option 2: Run Separately

**Terminal 1 - Backend:**
```bash
npm run dev:api
# or
bash scripts/dev-api.sh
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

## Setup Steps

### 1. Install Dependencies

```bash
# Frontend dependencies
npm install

# Backend dependencies (handled automatically by dev-api.sh)
cd api
uv sync
cd ..
```

### 2. Environment Variables

Create a `.env.local` file in the project root:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret

# Optional: Site URL for local development
VITE_SITE_URL=http://localhost:3000
```

**Where to find these:**
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`: Supabase Dashboard → Settings → API
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase Dashboard → Settings → API → `service_role` key (keep secret!)
- `SUPABASE_JWT_SECRET`: Supabase Dashboard → Settings → API → JWT Secret

### 3. Start Development Servers

```bash
# Start both frontend and backend
npm run dev:all
```

Or separately:

```bash
# Terminal 1: Backend API (port 8000)
npm run dev:api

# Terminal 2: Frontend (port 3000)
npm run dev
```

## Accessing the Application

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **API Health Check:** http://localhost:8000/api/
- **API Test Endpoint:** http://localhost:8000/api/test

## How It Works

### Frontend (Vite)
- Runs on `http://localhost:3000`
- Automatically proxies `/api/*` requests to `http://localhost:8000`
- Hot module replacement (HMR) for instant updates

### Backend (FastAPI)
- Runs on `http://localhost:8000`
- Uses `uvicorn` with `--reload` for auto-reload on code changes
- Connects to your Supabase project (same as production)

### Proxy Configuration

The `vite.config.ts` file is configured to proxy API requests:

```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true,
    },
  },
}
```

This means:
- Frontend calls to `/api/attendance` → proxied to `http://localhost:8000/api/attendance`
- Frontend calls to `/api/profile` → proxied to `http://localhost:8000/api/profile`
- Works seamlessly without CORS issues

## Development Workflow

### Recommended Workflow

1. **Make changes** to code (frontend or backend)
2. **Test locally** using `npm run dev:all`
3. **Verify functionality** - login, test features, check logs
4. **Fix any issues** - iterate quickly locally
5. **Commit and push** - only when everything works
6. **Vercel deploys** - automatic deployment for final verification

### Testing Checklist

Before pushing to GitHub, test locally:

- [ ] Frontend loads at http://localhost:3000
- [ ] Backend API responds at http://localhost:8000/api/test
- [ ] Login works
- [ ] Profile page loads
- [ ] Attendance page works
- [ ] Add student works
- [ ] Update profile works
- [ ] No console errors
- [ ] No network errors

## Troubleshooting

### Backend won't start

**Error: `uv: command not found`**
```bash
# Install uv
curl -LsSf https://astral.sh/uv/install.sh | sh
```

**Error: `Module not found`**
```bash
cd api
uv sync
```

**Error: `Port 8000 already in use`**
```bash
# Kill process on port 8000
lsof -ti:8000 | xargs kill -9
```

### Frontend won't start

**Error: `Port 3000 already in use`**
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

**Error: `Cannot find module`**
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### API calls fail

**Error: `Network Error` or `CORS Error`**
- Make sure backend is running on port 8000
- Check that `vite.config.ts` has the proxy configured
- Verify `.env.local` has correct Supabase credentials

**Error: `401 Unauthorized`**
- Check that `SUPABASE_JWT_SECRET` is set correctly
- Verify your Supabase project settings

### Environment Variables Not Loading

- Make sure `.env.local` is in the project root (not in `api/` or `src/`)
- Restart both servers after changing `.env.local`
- Frontend variables must start with `VITE_` prefix

## Debugging Tips

### Backend Logging

The FastAPI backend uses Python's `logging` module. Logs appear in the terminal where you ran `npm run dev:api`.

To see more detailed logs, check `api/index.py` - it uses:
- `log_info()` - General information
- `log_error()` - Error messages
- `log_warning()` - Warnings

### Frontend Debugging

- Open browser DevTools (F12)
- Check Console tab for errors
- Check Network tab for API calls
- React DevTools extension for component debugging

### API Testing

Test the API directly using curl:

```bash
# Health check
curl http://localhost:8000/api/

# Test endpoint
curl http://localhost:8000/api/test

# With authentication (get token from browser DevTools)
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8000/api/profile
```

## File Structure

```
.
├── api/
│   ├── index.py          # FastAPI backend
│   ├── pyproject.toml    # Python dependencies
│   └── uv.lock           # Locked dependencies
├── src/                   # React frontend
├── scripts/
│   ├── dev-api.sh        # Backend startup script
│   └── dev.sh            # Combined startup script
├── .env.local            # Environment variables (not in git)
├── package.json          # Frontend dependencies
└── vite.config.ts       # Vite configuration (includes proxy)
```

## When to Deploy to Vercel

Deploy to Vercel when:
- ✅ All features work locally
- ✅ No console errors
- ✅ All tests pass
- ✅ Ready for preview/testing
- ✅ Ready for production

**Don't deploy for:**
- ❌ Quick syntax fixes
- ❌ Testing if something works
- ❌ Debugging errors
- ❌ Experimenting with features

## Next Steps

1. Set up your `.env.local` file
2. Run `npm run dev:all`
3. Test all features locally
4. Only push to GitHub when everything works
5. Let Vercel handle final deployment verification

Happy coding! 🚀

