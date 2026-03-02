#!/bin/bash
# Fast baseline extraction - skips init if possible
# Usage: ./extract-baseline-fast.sh <project-ref> [output-file]

PROJECT_REF=$1
OUTPUT_FILE=${2:-"baseline-migration.sql"}

if [ -z "$PROJECT_REF" ]; then
  echo "Usage: $0 <project-ref> [output-file]"
  exit 1
fi

echo "📦 Fast baseline extraction"
echo "   Project: $PROJECT_REF"
echo ""

# Check if we're in a Supabase project already
if [ -f "supabase/config.toml" ]; then
  echo "✅ Already in Supabase project, using existing setup"
  WORK_DIR="."
else
  echo "🔧 Creating minimal setup..."
  mkdir -p supabase
  # Create minimal config
  cat > supabase/config.toml << EOF
project_id = "$PROJECT_REF"
EOF
  echo "✅ Minimal config created"
fi

echo ""
echo "🔗 Linking to project..."
if supabase link --project-ref "$PROJECT_REF"; then
  echo "✅ Linked"
else
  echo "❌ Link failed"
  echo ""
  echo "💡 Alternative: Use Supabase Dashboard > SQL Editor"
  echo "   Run: SELECT pg_get_tabledef('public')"
  exit 1
fi

echo ""
echo "📤 Dumping schema (this may take 1-5 minutes)..."
if supabase db dump --schema public > "$OUTPUT_FILE" 2>&1; then
  if [ -s "$OUTPUT_FILE" ]; then
    LINE_COUNT=$(wc -l < "$OUTPUT_FILE" | xargs)
    echo ""
    echo "✅ Success! Baseline extracted:"
    echo "   File: $(pwd)/$OUTPUT_FILE"
    echo "   Lines: $LINE_COUNT"
  else
    echo "❌ File is empty"
    echo "Last 20 lines:"
    tail -20 "$OUTPUT_FILE"
    exit 1
  fi
else
  echo "❌ Dump failed"
  echo "Check the error above"
  exit 1
fi
