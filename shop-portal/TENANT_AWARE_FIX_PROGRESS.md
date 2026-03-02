# Tenant-Aware Database Fix Progress

## Status: ~23 files remaining

### Pattern Applied
- Replace `createServerClient` with `NEXT_PUBLIC_SUPABASE_URL` → `getTenantSupabase()`
- Remove `cookies` import if only used for Supabase
- Add `getTenantSupabase` import

### Files Fixed ✅
- lib/supabase-server.ts
- app/(dashboard)/users/actions.ts
- app/(dashboard)/connections/actions.ts
- app/api/competitors/route.ts
- app/api/competitors/[id]/route.ts
- app/api/vat-rates/[id]/route.ts
- app/api/connections/[id]/route.ts
- app/api/permissions/user/[userId]/route.ts
- app/api/permissions/user/[userId]/batch/route.ts
- app/api/connections/test/route.ts
- app/api/products/[id]/images/route.ts
- app/api/categories/[id]/url-alias/route.ts
- app/api/products/[id]/competitor-links/route.ts
- app/api/products/[id]/variants/route.ts
- app/api/products/[id]/url-alias/route.ts
- app/api/products/bulk-sync/route.ts
- app/api/categories/[id]/generate-description/route.ts
- app/api/products/[id]/sources/route.ts
- app/api/search-console/indexing-status/route.ts
- app/api/categories/[id]/descriptions/route.ts
- app/api/categories/[id]/generate-meta/route.ts
- app/api/categories/[id]/sync/route.ts
- app/api/products/[id]/categories/route.ts
- app/api/scrape/batch/route.ts
- app/api/search-console/batch-sync/route.ts

### Files Remaining (with occurrence count)
- categories/[id]/descriptions/route.ts (1)
- products/[id]/sources/route.ts (1)
- products/[id]/url-alias/route.ts (1)
- categories/[id]/url-alias/route.ts (1)
- subscription/usage/route.ts (1) - Already uses getTenantSupabase but has one reference
- subscription/current/route.ts (1) - Already uses getTenantSupabase but has one reference
- connections/[id]/sync-products/route.ts (1)
- connections/[id]/tax-class-mappings/route.ts (3)
- shoprenter/structured-data/[sku]/route.ts (1)
- products/bulk-sync-to-shoprenter/route.ts (1)
- connections/[id]/sync-categories/route.ts (1)
- categories/[id]/url-alias/generate/route.ts (1)
- connections/[id]/script-tag/route.ts (3)
- products/[id]/search-console/route.ts (1)
- products/bulk-calculate-quality-scores/route.ts (1)
- products/[id]/quality-score/route.ts (2)
- products/bulk-sync-image-alt-text/route.ts (1)
- products/bulk-generate-image-alt-text/route.ts (1)
- products/bulk-url-alias/route.ts (1)
- products/[id]/competitor-links/[linkId]/route.ts (2)
- products/[id]/sources/[sourceId]/process/route.ts (2)
- products/[id]/sources/[sourceId]/route.ts (2)
- test-ai-system/route.ts (3)
