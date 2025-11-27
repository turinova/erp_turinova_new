#!/bin/bash
# Create a cleaned version safe for Supabase SQL Editor
# Removes all Supabase-managed schema objects (auth, storage, extensions, etc.)
# Keeps only public schema and custom objects

INPUT="supabase/master_schema_20251125_114903.sql"
OUTPUT="supabase/master_schema_for_sql_editor.sql"

echo "🧹 Creating SQL Editor-safe version (public schema only)..."

# Remove:
# 1. \restrict and \unrestrict commands
# 2. All CREATE SCHEMA statements for Supabase-managed schemas
# 3. All objects in auth, storage, extensions, realtime, graphql, vault, pgbouncer, supabase_migrations schemas
# 4. Keep only public schema objects and custom schemas

cat "$INPUT" | \
  sed '/^\\restrict/d' | \
  sed '/^\\unrestrict/d' | \
  sed '/^CREATE SCHEMA auth;$/d' | \
  sed '/^CREATE SCHEMA storage;$/d' | \
  sed '/^CREATE SCHEMA extensions;$/d' | \
  sed '/^CREATE SCHEMA realtime;$/d' | \
  sed '/^CREATE SCHEMA graphql;$/d' | \
  sed '/^CREATE SCHEMA graphql_public;$/d' | \
  sed '/^CREATE SCHEMA pgbouncer;$/d' | \
  sed '/^CREATE SCHEMA supabase_migrations;$/d' | \
  sed '/^CREATE SCHEMA vault;$/d' | \
  sed '/^CREATE.*auth\./d' | \
  sed '/^CREATE.*storage\./d' | \
  sed '/^CREATE.*extensions\./d' | \
  sed '/^CREATE.*realtime\./d' | \
  sed '/^CREATE.*graphql\./d' | \
  sed '/^CREATE.*graphql_public\./d' | \
  sed '/^CREATE.*pgbouncer\./d' | \
  sed '/^CREATE.*supabase_migrations\./d' | \
  sed '/^CREATE.*vault\./d' | \
  sed '/^COMMENT ON.*auth\./d' | \
  sed '/^COMMENT ON.*storage\./d' | \
  sed '/^COMMENT ON.*extensions\./d' | \
  sed '/^COMMENT ON.*realtime\./d' | \
  sed '/^COMMENT ON.*graphql\./d' | \
  sed '/^COMMENT ON.*vault\./d' | \
  sed '/^ALTER.*auth\./d' | \
  sed '/^ALTER.*storage\./d' | \
  sed '/^ALTER.*extensions\./d' | \
  sed '/^ALTER.*realtime\./d' | \
  sed '/^ALTER.*graphql\./d' | \
  sed '/^ALTER.*vault\./d' | \
  sed '/^GRANT.*auth\./d' | \
  sed '/^GRANT.*storage\./d' | \
  sed '/^GRANT.*extensions\./d' | \
  sed '/^GRANT.*realtime\./d' | \
  sed '/^GRANT.*graphql\./d' | \
  sed '/^GRANT.*vault\./d' | \
  sed '/^-- Name:.*Type:.*Schema: auth/d' | \
  sed '/^-- Name:.*Type:.*Schema: storage/d' | \
  sed '/^-- Name:.*Type:.*Schema: extensions/d' | \
  sed '/^-- Name:.*Type:.*Schema: realtime/d' | \
  sed '/^-- Name:.*Type:.*Schema: graphql/d' | \
  sed '/^-- Name:.*Type:.*Schema: vault/d' | \
  sed '/^-- Name:.*Type:.*Schema: pgbouncer/d' | \
  sed '/^-- Name:.*Type:.*Schema: supabase_migrations/d' \
  > "$OUTPUT"

echo "✅ Created: $OUTPUT"
echo "📏 Size: $(du -h "$OUTPUT" | cut -f1)"
echo "📝 Lines: $(wc -l < "$OUTPUT" | tr -d ' ')"
echo ""
echo "🔍 Verifying cleanup..."
if grep -q "^\\\\restrict\|^\\\\unrestrict" "$OUTPUT"; then
  echo "   ⚠️  Warning: Still contains \\restrict or \\unrestrict"
else
  echo "   ✓ No \\restrict or \\unrestrict commands found"
fi
if grep -q "auth\." "$OUTPUT"; then
  echo "   ⚠️  Warning: Still contains auth schema references"
  grep -n "auth\." "$OUTPUT" | head -3
else
  echo "   ✓ No auth schema references found"
fi
if grep -q "^CREATE TABLE.*public\." "$OUTPUT" || grep -q "^CREATE TABLE public\." "$OUTPUT" || grep -q "^CREATE TABLE IF NOT EXISTS public\." "$OUTPUT"; then
  TABLE_COUNT=$(grep -c "^CREATE TABLE" "$OUTPUT" || echo "0")
  echo "   ✓ Found $TABLE_COUNT tables in public schema"
fi
