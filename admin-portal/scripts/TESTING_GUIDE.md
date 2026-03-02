# Testing Guide - Step by Step

This guide walks you through testing each feature step by step.

## ✅ Step 1: Migration Fixes (COMPLETED)

**What was fixed:**
- ✅ `20250220_add_price_gross_column.sql` - Now idempotent (checks if table exists)
- ✅ `20250130_add_products_search_indexes.sql` - Indexes are conditional (check columns exist)
- ✅ All COMMENT statements are conditional (check indexes exist)

**Test:**
1. Try running the migrations on your new tenant
2. They should now work regardless of order

**Expected result:** No more "relation does not exist" errors

---

## 🧪 Step 2: Test Baseline Extraction

**What to test:**
Extract the baseline from your working tenant.

**Commands:**
```bash
cd admin-portal/scripts
./extract-baseline.sh <your-working-tenant-project-ref>
```

**Replace `<your-working-tenant-project-ref>` with your actual project ref.**

**What to check:**
1. ✅ Script runs without errors
2. ✅ Creates `baseline-migration.sql` file
3. ✅ File contains all your tables, functions, indexes
4. ✅ File size is reasonable (should be several KB)

**If it fails:**
- Check you're logged in: `supabase login`
- Verify project ref is correct
- Check you have access to the project

---

## 🧪 Step 3: Test New Tenant Setup

**What to test:**
Apply the baseline to your new tenant database.

**Commands:**
```bash
cd admin-portal/scripts
./setup-new-tenant.sh <new-tenant-project-ref> baseline-migration.sql test-tenant
```

**Replace:**
- `<new-tenant-project-ref>` with your new tenant's project ref
- `test-tenant` with a name for this tenant (optional)

**What to check:**
1. ✅ Script creates tenant directory
2. ✅ Links to new tenant project
3. ✅ Copies baseline migration
4. ✅ Applies migration successfully
5. ✅ All tables are created in Supabase Dashboard
6. ✅ No errors in the output

**If it fails:**
- Check the error message
- Verify project ref is correct
- Check you have access to the new project
- Review the baseline SQL for issues

---

## 🧪 Step 4: Verify Database Schema

**What to test:**
Verify all tables and features are present in the new tenant.

**In Supabase Dashboard:**
1. Go to Table Editor
2. Check these tables exist:
   - ✅ `users`
   - ✅ `pages`
   - ✅ `user_permissions`
   - ✅ `webshop_connections`
   - ✅ `shoprenter_products`
   - ✅ `vat`
   - ✅ `competitors`
   - ✅ `competitor_prices`
   - ✅ All other tables

**In SQL Editor:**
```sql
-- Check table count
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public';

-- Check specific tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

**Expected result:** All tables from working tenant are present

---

## 🧪 Step 5: Test Application Connection

**What to test:**
Connect your application to the new tenant and test basic functionality.

**Steps:**
1. Update environment variables to point to new tenant
2. Test login
3. Test basic queries
4. Test product listing
5. Test any critical features

**Expected result:** Application works with new tenant database

---

## 🧪 Step 6: Test Incremental Migrations

**What to test:**
Create a new migration in working tenant and apply it to new tenant.

**In working tenant:**
```bash
cd working-tenant-project
supabase migration new test_incremental
# Add a simple test change, e.g.:
# ALTER TABLE users ADD COLUMN IF NOT EXISTS test_col TEXT;
supabase db push
```

**In new tenant:**
```bash
cd admin-portal/scripts/tenants/test-tenant
# Copy the new migration
cp ../../../working-tenant-project/supabase/migrations/20250308_test_incremental.sql \
   supabase/migrations/
# Apply it
supabase db push
```

**Expected result:** New migration applies successfully to new tenant

---

## 📝 Next Steps After Testing

Once all tests pass:

1. **Document your working tenant project ref** for future baseline extractions
2. **Create a process** for applying new migrations to all tenants
3. **Set up migration tracking** in Admin DB (optional but recommended)
4. **Automate tenant setup** if you'll be creating many tenants

---

## 🐛 Troubleshooting

### Migration Errors

**Error: "relation does not exist"**
- ✅ Fixed! Migrations are now idempotent
- If still happening, check the migration file has existence checks

**Error: "column does not exist"**
- ✅ Fixed! Indexes check for columns before creating
- If still happening, check the migration file

**Error: "duplicate key value"**
- Migration already applied
- Check `supabase_migrations.schema_migrations` table
- Remove duplicate migration or skip it

### Script Errors

**"Supabase CLI not found"**
```bash
npm install -g supabase
```

**"Failed to link"**
- Check project ref is correct
- Verify you're logged in: `supabase login`
- Check you have access to the project

**"Permission denied"**
```bash
chmod +x admin-portal/scripts/*.sh
```

---

## ✅ Success Criteria

You'll know everything works when:

1. ✅ Baseline extraction completes successfully
2. ✅ New tenant setup completes without errors
3. ✅ All tables are present in new tenant
4. ✅ Application connects and works with new tenant
5. ✅ Incremental migrations can be applied

Once all these pass, you're ready for production! 🎉
