#!/bin/bash
# Convert JSON output from manual extraction to SQL file
# Usage: ./convert-json-to-sql.sh <json-file> [output-file]

JSON_FILE=$1
OUTPUT_FILE=${2:-"baseline-migration.sql"}

if [ -z "$JSON_FILE" ] || [ ! -f "$JSON_FILE" ]; then
  echo "Usage: $0 <json-file> [output-file]"
  echo ""
  echo "Example:"
  echo "  1. Copy JSON from Supabase Dashboard"
  echo "  2. Save to tables.json"
  echo "  3. Run: ./convert-json-to-sql.sh tables.json baseline-migration.sql"
  exit 1
fi

echo "📝 Converting JSON to SQL..."
echo "   Input: $JSON_FILE"
echo "   Output: $OUTPUT_FILE"
echo ""

# Extract create_statement from JSON and convert to SQL
cat > "$OUTPUT_FILE" << 'EOF'
-- =============================================================================
-- BASELINE MIGRATION - Generated from Manual Extraction
-- =============================================================================
-- WARNING: This only includes table structures
-- You still need to add: indexes, foreign keys, functions, RLS policies, etc.
-- 
-- Consider using tenant-database-template.sql instead which has everything!
-- =============================================================================

EOF

# Extract and format CREATE TABLE statements
jq -r '.[].create_statement' "$JSON_FILE" >> "$OUTPUT_FILE" 2>/dev/null || {
  # Fallback if jq is not installed - manual parsing
  echo "⚠️  jq not found, using manual parsing..."
  grep -o '"create_statement": "[^"]*"' "$JSON_FILE" | \
    sed 's/"create_statement": "//g' | \
    sed 's/"$//g' | \
    sed 's/\\n/\n/g' >> "$OUTPUT_FILE"
}

echo "" >> "$OUTPUT_FILE"
echo "-- =============================================================================" >> "$OUTPUT_FILE"
echo "-- NOTE: This file only contains table structures!" >> "$OUTPUT_FILE"
echo "-- You still need to add:" >> "$OUTPUT_FILE"
echo "--   - Primary keys (already in CREATE TABLE)" >> "$OUTPUT_FILE"
echo "--   - Foreign keys" >> "$OUTPUT_FILE"
echo "--   - Indexes" >> "$OUTPUT_FILE"
echo "--   - Functions" >> "$OUTPUT_FILE"
echo "--   - RLS policies" >> "$OUTPUT_FILE"
echo "--   - Triggers" >> "$OUTPUT_FILE"
echo "--   - Extensions" >> "$OUTPUT_FILE"
echo "--" >> "$OUTPUT_FILE"
echo "-- RECOMMENDATION: Use tenant-database-template.sql instead!" >> "$OUTPUT_FILE"
echo "-- =============================================================================" >> "$OUTPUT_FILE"

LINE_COUNT=$(wc -l < "$OUTPUT_FILE" | xargs)
echo "✅ Converted!"
echo "   File: $(pwd)/$OUTPUT_FILE"
echo "   Lines: $LINE_COUNT"
echo ""
echo "⚠️  WARNING: This is incomplete!"
echo "   It only has table structures, missing indexes, FKs, functions, etc."
echo ""
echo "💡 BETTER OPTION: Use the existing template:"
echo "   cp ../database-templates/tenant-database-template.sql baseline-migration.sql"
