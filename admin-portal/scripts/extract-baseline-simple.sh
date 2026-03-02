#!/bin/bash
# Simple baseline extraction with progress output
# Usage: ./extract-baseline-simple.sh <project-ref> [output-file]

PROJECT_REF=$1
OUTPUT_FILE=${2:-"baseline-migration.sql"}

if [ -z "$PROJECT_REF" ]; then
  echo "Usage: $0 <project-ref> [output-file]"
  exit 1
fi

echo "📦 Extracting baseline from: $PROJECT_REF"
echo ""

# Check login
echo "🔐 Checking authentication..."
if ! supabase projects list > /dev/null 2>&1; then
  echo "❌ Not logged in. Run: supabase login"
  exit 1
fi
echo "✅ Authenticated"
echo ""

# Create working directory in current location
WORK_DIR=".baseline-extract-$$"
mkdir -p "$WORK_DIR"
cd "$WORK_DIR"

echo "🔧 Setting up..."
supabase init > /dev/null 2>&1
echo "✅ Initialized"
echo ""

echo "🔗 Linking to project..."
echo "   (If this hangs, press Ctrl+C and try the manual approach in QUICK_START.md)"
if supabase link --project-ref "$PROJECT_REF" 2>&1; then
  echo "✅ Linked"
else
  LINK_EXIT=$?
  echo "❌ Link failed (exit code: $LINK_EXIT)"
  echo ""
  echo "💡 Try:"
  echo "   1. Check you're logged in: supabase login"
  echo "   2. Verify project ref: $PROJECT_REF"
  echo "   3. Use manual approach (see QUICK_START.md)"
  cd ..
  rm -rf "$WORK_DIR"
  exit 1
fi
echo ""

echo "📤 Dumping schema (this may take 1-5 minutes)..."
echo "   Please wait, this is downloading from Supabase..."
if supabase db dump --schema public > "../$OUTPUT_FILE" 2>&1; then
  cd ..
  rm -rf "$WORK_DIR"
  
  if [ -f "$OUTPUT_FILE" ] && [ -s "$OUTPUT_FILE" ]; then
    LINE_COUNT=$(wc -l < "$OUTPUT_FILE" | xargs)
    echo ""
    echo "✅ Success! Baseline extracted:"
    echo "   File: $(pwd)/$OUTPUT_FILE"
    echo "   Lines: $LINE_COUNT"
  else
    echo "❌ File is empty or missing"
    exit 1
  fi
else
  cd ..
  rm -rf "$WORK_DIR"
  echo "❌ Dump failed"
  exit 1
fi
