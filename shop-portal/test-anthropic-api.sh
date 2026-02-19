#!/bin/bash

# Test Anthropic API Key
# Usage: ./test-anthropic-api.sh

# Load API key from .env.local
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | xargs)
fi

if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "❌ Error: ANTHROPIC_API_KEY not found in .env.local"
  exit 1
fi

echo "🔑 Testing Anthropic API Key..."
echo "Key preview: ${ANTHROPIC_API_KEY:0:10}...${ANTHROPIC_API_KEY: -10}"
echo ""

# Test with claude-3-5-sonnet-latest
echo "Testing model: claude-3-5-sonnet-latest"
response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-3-5-sonnet-latest",
    "max_tokens": 50,
    "messages": [{"role": "user", "content": "ping"}]
  }')

http_status=$(echo "$response" | grep "HTTP_STATUS" | cut -d: -f2)
body=$(echo "$response" | sed '/HTTP_STATUS/d')

echo "HTTP Status: $http_status"
echo "Response:"
echo "$body" | jq '.' 2>/dev/null || echo "$body"
echo ""

if [ "$http_status" = "200" ]; then
  echo "✅ API Key is working!"
else
  echo "❌ API Key test failed"
  echo ""
  echo "Troubleshooting:"
  echo "1. Check your Anthropic console: https://console.anthropic.com/"
  echo "2. Verify the API key is correct"
  echo "3. Check account has credits/billing set up"
fi
