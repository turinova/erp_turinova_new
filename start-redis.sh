#!/bin/bash

# Redis Development Server Startup Script
# This script helps start Redis for development

echo "🚀 Starting Redis for development..."

# Check if Redis is already running
if pgrep -x "redis-server" > /dev/null; then
    echo "✅ Redis is already running"
    redis-cli ping
else
    echo "📦 Starting Redis server..."
    
    # Try to start Redis with different methods
    if command -v redis-server &> /dev/null; then
        # Start Redis server in background
        redis-server --daemonize yes --port 6379
        echo "✅ Redis server started on port 6379"
        
        # Wait a moment for Redis to start
        sleep 2
        
        # Test connection
        if redis-cli ping | grep -q "PONG"; then
            echo "✅ Redis is responding to ping"
        else
            echo "❌ Redis is not responding"
        fi
    else
        echo "❌ Redis is not installed"
        echo "📋 To install Redis:"
        echo "   macOS: brew install redis"
        echo "   Ubuntu: sudo apt-get install redis-server"
        echo "   Or use Docker: docker run -d -p 6379:6379 redis:alpine"
    fi
fi

echo ""
echo "🔧 Redis Configuration:"
echo "   Host: localhost"
echo "   Port: 6379"
echo "   URL: redis://localhost:6379"
echo ""
echo "🧪 Test Redis connection:"
echo "   redis-cli ping"
echo ""
echo "📊 Monitor Redis:"
echo "   redis-cli monitor"
