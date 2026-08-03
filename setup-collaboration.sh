#!/bin/bash

# Quick setup script for real-time collaboration
# Run this from the embed-pdf-app directory

echo "🚀 Setting up Real-Time PDF Collaboration..."
echo ""

# Check if server dependencies are installed
if [ ! -d "server/node_modules" ]; then
    echo "📦 Installing server dependencies..."
    cd server && npm install && cd ..
    echo "✅ Server dependencies installed"
else
    echo "✅ Server dependencies already installed"
fi

# Check if client dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing client dependencies..."
    npm install
    echo "✅ Client dependencies installed"
else
    echo "✅ Client dependencies already installed"
fi

# Create data directory if it doesn't exist
mkdir -p server/data/backups
echo "✅ Data directory created"

# Create initial persistence file if it doesn't exist
if [ ! -f "server/data/persistence.json" ]; then
    echo '{"documents":{}}' > server/data/persistence.json
    echo "✅ Initial persistence file created"
fi

echo ""
echo "✨ Setup Complete!"
echo ""
echo "📝 To start the collaboration system, run:"
echo "   npm run dev:all"
echo ""
echo "This will start both the Socket.IO server and the Vite dev server."
echo ""
echo "🌐 Then open http://localhost:5173 in your browser"
echo ""
echo "For deployment instructions, see README-realtime-collaboration.md"
