# Baseline Migration Options

You have **3 options** for creating a baseline migration:

## Option 1: Use Existing Template (RECOMMENDED) ⭐

**Fastest and most complete!**

```bash
cd admin-portal/scripts
cp ../database-templates/tenant-database-template.sql baseline-migration.sql
```

**Why this is best:**
- ✅ Has ALL migrations with fixes applied
- ✅ Includes indexes, foreign keys, functions, RLS policies
- ✅ Already tested and fixed
- ✅ Ready to use immediately

**Then test it:**
```bash
./setup-new-tenant.sh <new-tenant-project-ref> baseline-migration.sql
```

---

## Option 2: Manual Extraction (What you just did)

You extracted tables manually, but it's **incomplete**:
- ✅ Has table structures
- ❌ Missing primary keys
- ❌ Missing foreign keys  
- ❌ Missing indexes
- ❌ Missing functions
- ❌ Missing RLS policies
- ❌ Missing triggers
- ❌ Missing extensions

**To complete it, you'd need to:**
1. Get indexes (separate query)
2. Get foreign keys (separate query)
3. Get functions (separate query)
4. Get RLS policies (separate query)
5. Get triggers (separate query)
6. Add extensions (pg_trgm, vector, etc.)

**This is a lot of work!** That's why Option 1 is recommended.

---

## Option 3: Fix Manual Extraction

If you want to use your manual extraction, I've created:
- `baseline-from-json.sql` - Your tables converted to SQL
- But it's still incomplete (missing everything else)

You'd need to run additional queries to get:
- Indexes
- Foreign keys
- Functions
- RLS policies
- etc.

---

## My Recommendation

**Use Option 1** - the existing template. It's:
- ✅ Complete
- ✅ Tested
- ✅ Fixed (all dependency issues resolved)
- ✅ Ready to use

The template at `admin-portal/database-templates/tenant-database-template.sql` has:
- All 37+ migrations
- All fixes applied
- All dependencies resolved
- Conditional indexes
- Conditional comments
- Everything you need

Just copy it and use it!
