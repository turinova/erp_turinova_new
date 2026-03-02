#!/bin/bash
# Script to batch-fix tenant-aware Supabase client usage
# This replaces createServerClient with NEXT_PUBLIC_SUPABASE_URL with getTenantSupabase()

FILES=(
  "src/app/api/categories/[id]/descriptions/route.ts"
  "src/app/api/categories/[id]/generate-description/route.ts"
  "src/app/api/categories/[id]/generate-meta/route.ts"
  "src/app/api/categories/[id]/sync/route.ts"
  "src/app/api/categories/[id]/url-alias/generate/route.ts"
  "src/app/api/connections/[id]/script-tag/route.ts"
  "src/app/api/connections/[id]/sync-categories/route.ts"
  "src/app/api/connections/[id]/sync-products/route.ts"
  "src/app/api/connections/[id]/tax-class-mappings/route.ts"
  "src/app/api/products/[id]/categories/route.ts"
  "src/app/api/products/[id]/competitor-links/[linkId]/route.ts"
  "src/app/api/products/[id]/quality-score/route.ts"
  "src/app/api/products/[id]/search-console/route.ts"
  "src/app/api/products/[id]/sources/[sourceId]/process/route.ts"
  "src/app/api/products/[id]/sources/[sourceId]/route.ts"
  "src/app/api/products/[id]/sources/route.ts"
  "src/app/api/products/[id]/url-alias/route.ts"
  "src/app/api/products/[id]/variants/route.ts"
  "src/app/api/products/bulk-calculate-quality-scores/route.ts"
  "src/app/api/products/bulk-generate-image-alt-text/route.ts"
  "src/app/api/products/bulk-sync-image-alt-text/route.ts"
  "src/app/api/products/bulk-sync-to-shoprenter/route.ts"
  "src/app/api/products/bulk-sync/route.ts"
  "src/app/api/products/bulk-url-alias/route.ts"
  "src/app/api/scrape/batch/route.ts"
  "src/app/api/search-console/batch-sync/route.ts"
  "src/app/api/search-console/indexing-status/route.ts"
  "src/app/api/shoprenter/structured-data/[sku]/route.ts"
  "src/app/api/test-ai-system/route.ts"
)

echo "This script would fix ${#FILES[@]} files"
echo "Files to fix:"
for file in "${FILES[@]}"; do
  echo "  - $file"
done
