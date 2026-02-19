#!/bin/bash
# Script to run FastAPI backend locally for development
# This runs the Python API on http://localhost:8000

cd "$(dirname "$0")/.." || exit

echo "🚀 Starting FastAPI backend on http://localhost:8002"
echo "📝 Make sure you have:"
echo "   - Python 3.12+ installed"
echo "   - uv installed (https://github.com/astral-sh/uv)"
echo "   - Environment variables set in .env.local"
echo ""

# Check if uv is installed
if ! command -v uv &> /dev/null; then
    echo "❌ Error: uv is not installed"
    echo "   Install it from: https://github.com/astral-sh/uv"
    exit 1
fi

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "⚠️  Warning: .env.local not found"
    echo "   Create it with your Supabase credentials"
fi

# Install dependencies if needed
if [ ! -f "api/uv.lock" ]; then
    echo "📦 Installing Python dependencies..."
    cd api || exit
    uv sync
    cd ..
fi

# Load environment variables from .env.local if it exists
if [ -f .env.local ]; then
    echo "📝 Loading environment variables from .env.local..."
    # Use a safer method to load env vars (handles spaces and special chars)
    set -a
    source .env.local
    set +a
    echo "✅ Environment variables loaded"
    
    # Verify key variables are set
    if [ -z "$VITE_SUPABASE_URL" ]; then
        echo "⚠️  Warning: VITE_SUPABASE_URL not found in .env.local"
    else
        echo "✅ VITE_SUPABASE_URL is set"
    fi
else
    echo "⚠️  Warning: .env.local not found"
    echo "   Create it with your Supabase credentials"
fi

# Run the FastAPI server
echo "🌐 Starting FastAPI server..."
cd api || exit

# Use uv to run uvicorn with the installed dependencies
# Environment variables are already exported above
uv run uvicorn index:app --host 0.0.0.0 --port 8002 --reload

