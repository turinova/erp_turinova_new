# 🔄 RESTORE OPTIMIZATION CHANGES

If you want to revert all optimization changes, follow these steps:

## 1. Revert Frontend Changes

```bash
# Revert to original API endpoints
git checkout HEAD~1 -- src/app/(dashboard)/currencies/page.tsx
git checkout HEAD~1 -- src/app/(dashboard)/units/page.tsx  
git checkout HEAD~1 -- src/app/(dashboard)/brands/page.tsx
git checkout HEAD~1 -- src/contexts/PermissionContext.tsx
```

## 2. Remove Optimization Files

```bash
# Remove optimization files
rm -rf src/lib/api-cache.ts
rm -rf src/lib/supabase-optimized.ts
rm -rf src/hooks/useUltraOptimizedData.ts
rm -rf src/app/api/*/ultra-optimized/
rm -rf test-performance-optimized.sh
rm -rf APPLY_DATABASE_INDEXES.sql
```

## 3. Database Indexes (Optional)

The database indexes can stay - they only improve performance and don't break anything.
If you want to remove them, run this SQL in Supabase:

```sql
-- Remove performance indexes (optional - not recommended)
DROP INDEX IF EXISTS idx_units_name_active;
DROP INDEX IF EXISTS idx_units_shortform_active;
DROP INDEX IF EXISTS idx_brands_name_active;
DROP INDEX IF EXISTS idx_customers_name_active;
DROP INDEX IF EXISTS idx_customers_email_active;
DROP INDEX IF EXISTS idx_currencies_name_active;
DROP INDEX IF EXISTS idx_user_permissions_user_id;
DROP INDEX IF EXISTS idx_user_permissions_page_id;
DROP INDEX IF EXISTS idx_pages_path;
```

## 4. Restart Servers

```bash
# Kill existing processes
pkill -f "pnpm dev"
pkill -f "php.*8000"

# Restart servers
cd /Volumes/T7/erp_turinova_new/starter-kit
NODE_OPTIONS="--max-old-space-size=4096" pnpm dev &
cd /Volumes/T7/erp_turinova_new/php
php -S localhost:8000 &
```

## ⚠️ Note

The database indexes should be kept as they significantly improve performance without any downsides.
Only remove them if you're experiencing specific issues.

## 🎯 Current Performance

With the applied optimizations:
- ✅ Database indexes applied
- ✅ Optimized API endpoints working
- ✅ Frontend using optimized APIs
- ✅ Site loading fast

**Recommendation**: Keep the current optimizations as they provide significant performance improvements!
