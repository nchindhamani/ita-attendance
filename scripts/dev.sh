#!/bin/bash
# Script to run both frontend and backend in development mode
# Frontend: http://localhost:3000
# Backend: http://localhost:8000

cd "$(dirname "$0")/.." || exit

echo "🚀 Starting ITA Attendance Portal in development mode"
echo ""
echo "📦 Frontend: http://localhost:3000"
echo "🔧 Backend API: http://localhost:8000"
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "⚠️  Warning: .env.local not found"
    echo "   Create it with your Supabase credentials:"
    echo "   - VITE_SUPABASE_URL"
    echo "   - VITE_SUPABASE_ANON_KEY"
    echo "   - SUPABASE_SERVICE_ROLE_KEY"
    echo "   - SUPABASE_JWT_SECRET"
    echo ""
fi

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down servers..."
    kill $FRONTEND_PID $BACKEND_PID 2>/dev/null
    exit
}

trap cleanup SIGINT SIGTERM

# Start backend in background
echo "🔧 Starting backend API..."
./scripts/dev-api.sh &
BACKEND_PID=$!

# Wait a bit for backend to start
sleep 3

# Start frontend
echo "📦 Starting frontend..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ Development servers started!"
echo "   Frontend: http://localhost:3000"
echo "   Backend: http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for both processes
wait

