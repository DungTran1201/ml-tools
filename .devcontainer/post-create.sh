#!/bin/bash

# Post-create script for GitHub Codespaces
# This runs after the dev container is created

set -e

echo "📦 Setting up ML Tools development environment..."

# Install frontend dependencies
echo "📋 Installing frontend dependencies..."
cd /workspaces/ml-tools/frontend
npm install
# or if using pnpm:
# pnpm install

# Install backend dependencies (Node.js)
echo "📋 Installing backend dependencies..."
cd /workspaces/ml-tools/backend
npm install
# or if using Python:
# pip install -r requirements.txt

# Create .env files if they don't exist
echo "🔧 Setting up environment files..."
if [ ! -f /workspaces/ml-tools/frontend/.env.local ]; then
  cp /workspaces/ml-tools/frontend/.env.example /workspaces/ml-tools/frontend/.env.local
fi

if [ ! -f /workspaces/ml-tools/backend/.env.local ]; then
  cp /workspaces/ml-tools/backend/.env.example /workspaces/ml-tools/backend/.env.local
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "🚀 To start development:"
echo "   Frontend: cd frontend && npm run dev"
echo "   Backend:  cd backend && npm start  (or python server.py for Flask)"
echo ""
echo "📡 GitHub Codespaces URLs will be auto-generated"
echo "   Frontend: https://<codespace-name>-5173.app.github.dev"
echo "   Backend:  https://<codespace-name>-5000.app.github.dev"
echo ""
