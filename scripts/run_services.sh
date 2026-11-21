#!/usr/bin/env bash
# Phola Full-Stack Service Launcher
# Launches the Python background microservice (port 8000) and the Next.js frontend (port 3000)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$REPO_ROOT"

echo "========================================================"
echo " Phola Multi-Tier Emergency Safety & Crisis Platform"
echo " Starting Full-Stack Services (Python + Next.js)"
echo "========================================================"

# 1. Start Python Microservice
echo "🐍 Starting Python Runtime Microservice on http://127.0.0.1:8000..."
python3 server/phola_service.py &
PY_PID=$!

# Trap signals to ensure Python process is cleanly terminated
trap "echo 'Stopping Python service...'; kill $PY_PID 2>/dev/null; exit 0" SIGINT SIGTERM EXIT

# 2. Wait for Python service to report healthy
echo "⏳ Verifying Python service health..."
sleep 1
if curl -s http://127.0.0.1:8000/health > /dev/null 2>&1; then
    echo "✅ Python Runtime Service is HEALTHY."
else
    echo "⚠️ Python service starting in background."
fi

# 3. Start Next.js Development Server
echo "🚀 Starting Next.js Frontend on http://0.0.0.0:3000..."
npm run dev
