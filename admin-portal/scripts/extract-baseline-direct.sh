#!/bin/bash
# Direct baseline extraction - no init, no temp directories
# Usage: ./extract-baseline-direct.sh <project-ref> [output-file]

set -e

PROJECT_REF=$1
OUTPUT_FILE=${2:-"baseline-migration.sql"}

if [ -z "$PROJECT_REF" ]; then
  echo "❌ Error: Project ref is required"
  echo "Usage: ./extract-baseline-direct.sh <project-ref> [output-file]"
  exit 1
fi

echo "📦 Extracting baseline from working tenant..."
echo "   Project Ref: $PROJECT_REF"
echo "   Output: $OUTPUT_FILE"
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
  echo "❌ Error: Supabase CLI is not installed"
  exit 1
fi

# Direct dump - requires linking first, but simpler approach
echo "📤 Extracting schema..."
echo "   Step 1: Quick init and link..."
echo ""

# Create minimal setup in current directory
if [ ! -d ".supabase" ]; then
  mkdir -p .supabase
fi

# Initialize in current dir (minimal)
if [ ! -f "supabase/config.toml" ]; then
  supabase init > /dev/null 2>&1 || {
    # If init fails, try creating minimal config
    mkdir -p supabase
    cat > supabase/config.toml << EOF
project_id = "$PROJECT_REF"
EOF
  }
fi

# Link to project
echo "   Step 2: Linking to project..."
if supabase link --project-ref "$PROJECT_REF" > /dev/null 2>&1; then
  echo "   ✅ Linked"
else
  echo "   ⚠️  Link failed, trying direct dump..."
fi

# Extract schema
echo "   Step 3: Dumping schema (this may take 1-5 minutes)..."
if supabase db dump --schema public > "$OUTPUT_FILE" 2>&1; then
  if [ -f "$OUTPUT_FILE" ] && [ -s "$OUTPUT_FILE" ]; then
    LINE_COUNT=$(wc -l < "$OUTPUT_FILE" | xargs)
    FILE_SIZE=$(ls -lh "$OUTPUT_FILE" | awk '{print $5}')
    echo ""
    echo "✅ Baseline extracted successfully!"
    echo "   File: $(pwd)/$OUTPUT_FILE"
    echo "   Size: $FILE_SIZE ($LINE_COUNT lines)"
    echo ""
    echo "📝 Next steps:"
    echo "   1. Review the baseline file"
    echo "   2. Test it on a new tenant: ./setup-new-tenant.sh <new-ref> $OUTPUT_FILE"
    
    # Cleanup
    rm -rf supabase .supabase 2>/dev/null || true
  else
    echo "❌ Error: File was not created or is empty"
    cat "$OUTPUT_FILE" 2>/dev/null || true
    exit 1
  fi
else
  EXIT_CODE=$?
  echo "❌ Error: Failed to extract schema (exit code: $EXIT_CODE)"
  echo ""
  echo "Last 10 lines of output:"
  tail -10 "$OUTPUT_FILE" 2>/dev/null || echo "No output captured"
  echo ""
  echo "💡 Troubleshooting:"
  echo "   1. Make sure you're logged in: supabase login"
  echo "   2. Verify project ref is correct: $PROJECT_REF"
  echo "   3. Check you have access to the project"
  echo "   4. Try manual dump: supabase db dump --schema public"
  exit 1
fi
