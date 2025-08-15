#!/bin/bash

# ConPort Navigator Startup Script

echo "🚀 Starting ConPort Navigator..."
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Check if port 3456 is already in use
if lsof -Pi :3456 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Port 3456 is already in use!"
    echo "   Killing existing process..."
    kill $(lsof -Pi :3456 -sTCP:LISTEN -t)
    sleep 1
fi

# Start the server
echo "🌐 Starting server on http://localhost:3456"
echo ""
npm run start:improved

# If server crashes, offer to restart
if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Server stopped unexpectedly"
    echo "   Run './start.sh' to restart"
fi