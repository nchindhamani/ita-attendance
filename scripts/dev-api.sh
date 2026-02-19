#!/bin/bash
# Script to run FastAPI backend locally for development
# This runs the Python API on http://localhost:8000

cd "$(dirname "$0")/.." || exit

echo "🚀 Starting FastAPI backend on http://localhost:8000"
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
    export $(cat .env.local | grep -v '^#' | xargs)
fi

# Run the FastAPI server
echo "🌐 Starting FastAPI server..."
cd api || exit

# Use uv to run uvicorn with the installed dependencies
uv run uvicorn index:app --host 0.0.0.0 --port 8000 --reload

