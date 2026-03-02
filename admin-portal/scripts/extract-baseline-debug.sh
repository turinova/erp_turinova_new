#!/bin/bash
# Debug version - shows all output
# Extract baseline migration from working tenant

PROJECT_REF=$1
OUTPUT_FILE=${2:-"baseline-migration.sql"}

if [ -z "$PROJECT_REF" ]; then
  echo "❌ Error: Project ref is required"
  exit 1
fi

echo "📦 Extracting baseline from working tenant..."
echo "   Project Ref: $PROJECT_REF"
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
  echo "❌ Error: Supabase CLI is not installed"
  exit 1
fi

# Save original directory
ORIGINAL_DIR=$(pwd)

# Create temp directory
TEMP_DIR=$(mktemp -d)
echo "📁 Temp directory: $TEMP_DIR"
cd "$TEMP_DIR"

# Initialize Supabase
echo "🔧 Initializing Supabase..."
if supabase init; then
  echo "✅ Initialized"
else
  # Check if config file exists (init might warn about git but still work)
  if [ -f "supabase/config.toml" ]; then
    echo "✅ Initialized (with git warning)"
  else
    echo "❌ Failed to initialize"
    exit 1
  fi
fi

# Link to working tenant
echo ""
echo "🔗 Linking to working tenant..."
if supabase link --project-ref "$PROJECT_REF"; then
  echo "✅ Linked"
else
  echo "❌ Failed to link"
  exit 1
fi

# Extract schema
echo ""
echo "📤 Extracting schema..."
if supabase db dump --schema public > "$OUTPUT_FILE"; then
  echo "✅ Dump created"
  mv "$OUTPUT_FILE" "$ORIGINAL_DIR/$OUTPUT_FILE"
  echo "✅ Baseline extracted: $ORIGINAL_DIR/$OUTPUT_FILE"
else
  echo "❌ Failed to dump"
  exit 1
fi

# Cleanup
rm -rf "$TEMP_DIR"
