#!/bin/bash
# Extract baseline migration from working tenant
# Usage: ./extract-baseline.sh <working-tenant-project-ref> [output-file]

set -e

PROJECT_REF=$1
OUTPUT_FILE=${2:-"baseline-migration.sql"}

if [ -z "$PROJECT_REF" ]; then
  echo "❌ Error: Project ref is required"
  echo "Usage: ./extract-baseline.sh <project-ref> [output-file]"
  exit 1
fi

echo "📦 Extracting baseline from working tenant..."
echo "   Project Ref: $PROJECT_REF"
echo "   Output: $OUTPUT_FILE"
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
  echo "❌ Error: Supabase CLI is not installed"
  echo "   Install it: https://supabase.com/docs/guides/cli"
  exit 1
fi

# Save original directory
ORIGINAL_DIR=$(pwd)

# Create temp directory
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

# Initialize Supabase
echo "🔧 Initializing Supabase..."
supabase init > /dev/null 2>&1 || true
# Check if config file exists (init might warn about git but still work)
if [ ! -f "supabase/config.toml" ]; then
  echo "❌ Error: Failed to initialize Supabase"
  rm -rf "$TEMP_DIR"
  exit 1
fi
echo "✅ Initialized"

# Link to working tenant
echo "🔗 Linking to working tenant..."
LINK_OUTPUT=$(supabase link --project-ref "$PROJECT_REF" 2>&1)
LINK_EXIT_CODE=$?
if [ $LINK_EXIT_CODE -ne 0 ]; then
  echo "❌ Error: Failed to link to project"
  echo "   Details: $LINK_OUTPUT"
  echo "   Check your project ref and access"
  rm -rf "$TEMP_DIR"
  exit 1
fi

# Extract schema
echo "📤 Extracting schema..."
DUMP_OUTPUT=$(supabase db dump --schema public 2>&1)
DUMP_EXIT_CODE=$?
if [ $DUMP_EXIT_CODE -eq 0 ]; then
  echo "$DUMP_OUTPUT" > "$OUTPUT_FILE"
  # Move to original directory (where script was called from)
  if [ -f "$OUTPUT_FILE" ]; then
    mv "$OUTPUT_FILE" "$ORIGINAL_DIR/$OUTPUT_FILE"
  fi
  echo "✅ Baseline extracted successfully!"
  echo "   File: $ORIGINAL_DIR/$OUTPUT_FILE"
  echo "   Size: $(wc -l < "$OUTPUT_FILE" | xargs) lines"
  echo ""
  echo "📝 Next steps:"
  echo "   1. Review the baseline file"
  echo "   2. Test it on a new tenant"
  echo "   3. Use it as the foundation for new tenants"
else
  echo "❌ Error: Failed to extract schema"
  echo "   Details: $DUMP_OUTPUT"
  rm -rf "$TEMP_DIR"
  exit 1
fi

# Cleanup
rm -rf "$TEMP_DIR"
