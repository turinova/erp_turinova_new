#!/bin/bash
# Setup new tenant database with baseline migration
# Usage: ./setup-new-tenant.sh <new-tenant-project-ref> <baseline-file> [tenant-name]

set -e

PROJECT_REF=$1
BASELINE_FILE=$2
TENANT_NAME=${3:-"tenant-$(date +%s)"}

if [ -z "$PROJECT_REF" ] || [ -z "$BASELINE_FILE" ]; then
  echo "❌ Error: Project ref and baseline file are required"
  echo "Usage: ./setup-new-tenant.sh <project-ref> <baseline-file> [tenant-name]"
  exit 1
fi

if [ ! -f "$BASELINE_FILE" ]; then
  echo "❌ Error: Baseline file not found: $BASELINE_FILE"
  exit 1
fi

echo "🚀 Setting up new tenant database..."
echo "   Project Ref: $PROJECT_REF"
echo "   Baseline: $BASELINE_FILE"
echo "   Tenant Name: $TENANT_NAME"
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
  echo "❌ Error: Supabase CLI is not installed"
  echo "   Install it: https://supabase.com/docs/guides/cli"
  exit 1
fi

# Create tenant directory
TENANT_DIR="tenants/$TENANT_NAME"
mkdir -p "$TENANT_DIR"
cd "$TENANT_DIR"

echo "📁 Created tenant directory: $TENANT_DIR"

# Initialize Supabase
echo "🔧 Initializing Supabase..."
if [ -d "supabase" ]; then
  echo "⚠️  Supabase already initialized, skipping..."
else
  supabase init
fi

# Link to new tenant project
echo "🔗 Linking to new tenant project..."
if supabase link --project-ref "$PROJECT_REF" > /dev/null 2>&1; then
  echo "✅ Linked successfully"
else
  echo "❌ Error: Failed to link to project. Check your project ref and access."
  exit 1
fi

# Copy baseline migration
BASELINE_MIGRATION="supabase/migrations/$(date +%Y%m%d)_000000_baseline_schema.sql"
echo "📋 Copying baseline migration..."
cp "../../$BASELINE_FILE" "$BASELINE_MIGRATION"
echo "✅ Baseline copied to: $BASELINE_MIGRATION"

# Apply migrations
echo ""
echo "🔄 Applying migrations..."
echo "   This may take a few minutes..."
if supabase db push; then
  echo ""
  echo "✅ Tenant database setup complete!"
  echo ""
  echo "📝 Tenant Info:"
  echo "   Name: $TENANT_NAME"
  echo "   Project Ref: $PROJECT_REF"
  echo "   Directory: $TENANT_DIR"
  echo ""
  echo "🎯 Next steps:"
  echo "   1. Verify the database schema in Supabase Dashboard"
  echo "   2. Test basic functionality"
  echo "   3. Register tenant in Admin DB"
else
  echo ""
  echo "❌ Error: Failed to apply migrations"
  echo "   Check the error messages above"
  exit 1
fi
