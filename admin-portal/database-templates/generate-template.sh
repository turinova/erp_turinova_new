#!/bin/bash
# Script to generate consolidated tenant database template
# Combines all tenant database migrations in chronological order

OUTPUT_FILE="tenant-database-template.sql"
MIGRATIONS_DIR="../../shop-portal/supabase/migrations"

# List of migrations to EXCLUDE (admin DB, one-time setup, etc.)
EXCLUDE_PATTERNS=(
  "admin"
  "tenant_subscription"
  "tenant_credit_usage_logs_admin"
  "get_tenant_by_user_email"
  "create_tenant_credit_usage_function"
  "create_default_tenant"
  "map_users"
  "create_tenant_database_setup"
  "add_test_override"
  "map_your_users"
  "add_credit_balance_system"
  "create_tenant_migration_tracking"
)

# Header
cat > "$OUTPUT_FILE" << 'EOF'
-- =============================================================================
-- TURINOVA ERP - TENANT DATABASE TEMPLATE
-- =============================================================================
-- This is a consolidated template combining all tenant database migrations
-- Run this SQL in a NEW Supabase project's SQL Editor to set up a tenant database
-- 
-- Generated: $(date)
-- Version: 1.0
-- 
-- IMPORTANT: This template includes all current migrations. When you add new
-- migrations, update this template and apply them to existing tenants manually.
-- =============================================================================

EOF

# Core migrations that must come first (foundation)
CORE_MIGRATIONS=(
  "20250218_create_permission_system.sql"
  "20250218_create_webshop_connections.sql"
  "20250218_fix_rls_policies.sql"
  "20250219_create_products_tables.sql"
)

# Add core migrations first
for core_migration in "${CORE_MIGRATIONS[@]}"; do
  migration="$MIGRATIONS_DIR/$core_migration"
  if [ -f "$migration" ]; then
    echo "" >> "$OUTPUT_FILE"
    echo "-- =============================================================================" >> "$OUTPUT_FILE"
    echo "-- Migration: $core_migration" >> "$OUTPUT_FILE"
    echo "-- =============================================================================" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    cat "$migration" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
  fi
done

# Add other migrations in order (excluding core migrations and excluded patterns)
for migration in $(ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort); do
  # Skip if it's a core migration (already added)
  skip=false
  for core_migration in "${CORE_MIGRATIONS[@]}"; do
    if [[ "$migration" == *"$core_migration" ]]; then
      skip=true
      break
    fi
  done
  
  if [ "$skip" = true ]; then
    continue
  fi
  
  # Check if migration should be excluded
  exclude=false
  for pattern in "${EXCLUDE_PATTERNS[@]}"; do
    if [[ "$migration" == *"$pattern"* ]]; then
      exclude=true
      break
    fi
  done
  
  if [ "$exclude" = false ]; then
    echo "" >> "$OUTPUT_FILE"
    echo "-- =============================================================================" >> "$OUTPUT_FILE"
    echo "-- Migration: $(basename $migration)" >> "$OUTPUT_FILE"
    echo "-- =============================================================================" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    cat "$migration" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
  fi
done

echo "Template generated: $OUTPUT_FILE"
echo "Total size: $(wc -l < $OUTPUT_FILE) lines"
