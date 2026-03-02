# Tenant Database Setup Scripts

These scripts help you manage tenant databases using Supabase CLI migrations.

## Prerequisites

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   supabase login
   ```

## Step-by-Step Workflow

### Step 1: Extract Baseline from Working Tenant

Extract the current schema from your working tenant (development database):

```bash
cd admin-portal/scripts
./extract-baseline.sh <working-tenant-project-ref>
```

This creates `baseline-migration.sql` in the current directory.

**Test it:**
- Review the generated SQL file
- Check that it contains all your tables, functions, and indexes

### Step 2: Setup New Tenant

Apply the baseline to a new tenant database:

```bash
./setup-new-tenant.sh <new-tenant-project-ref> baseline-migration.sql [tenant-name]
```

**Test it:**
- Check Supabase Dashboard for the new tenant
- Verify all tables are created
- Test basic queries

### Step 3: Going Forward - Incremental Migrations

When you create new features in the working tenant:

1. Create migration in working tenant:
   ```bash
   cd working-tenant-project
   supabase migration new add_new_feature
   # Edit the migration file
   supabase db push
   ```

2. Copy to new tenant:
   ```bash
   cp working-tenant-project/supabase/migrations/20250308_add_new_feature.sql \
      tenants/new-tenant/supabase/migrations/
   
   cd tenants/new-tenant
   supabase db push
   ```

## Scripts

### `extract-baseline.sh`

Extracts the current schema from a working tenant database.

**Usage:**
```bash
./extract-baseline.sh <project-ref> [output-file]
```

**Example:**
```bash
./extract-baseline.sh pwpxspvuyrgvuugamquh baseline.sql
```

### `setup-new-tenant.sh`

Sets up a new tenant database with the baseline migration.

**Usage:**
```bash
./setup-new-tenant.sh <project-ref> <baseline-file> [tenant-name]
```

**Example:**
```bash
./setup-new-tenant.sh new-project-ref baseline.sql customer-abc
```

## Troubleshooting

### Migration Errors

If you get dependency errors:
1. Check that migrations are idempotent (wrap ALTER in existence checks)
2. Verify migration order (alphabetical by filename)
3. Check that all required tables exist before referencing them

### Link Errors

If linking fails:
1. Verify project ref is correct
2. Check you're logged in: `supabase login`
3. Verify you have access to the project

### Baseline Issues

If baseline extraction fails:
1. Check you have access to the working tenant
2. Verify Supabase CLI is up to date: `supabase update`
3. Try manual extraction: `supabase db dump --schema public`

## Migration Best Practices

1. **Always wrap ALTER statements** in existence checks:
   ```sql
   DO $$
   BEGIN
     IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'my_table') THEN
       ALTER TABLE my_table ADD COLUMN IF NOT EXISTS new_col TEXT;
     END IF;
   END $$;
   ```

2. **Use IF NOT EXISTS** for CREATE statements:
   ```sql
   CREATE INDEX IF NOT EXISTS idx_name ON table(column);
   ```

3. **Test migrations** on a copy before applying to production

4. **Keep migrations small** - one feature per migration

5. **Document dependencies** in migration comments
