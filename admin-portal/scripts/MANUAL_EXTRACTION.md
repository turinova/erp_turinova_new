# Manual Baseline Extraction Guide

Since `supabase init` keeps hanging, here's the **manual approach** using Supabase Dashboard:

## Step 1: Get Schema via Supabase Dashboard

1. Go to your Supabase project: https://supabase.com/dashboard/project/bsfqomjdjqvqdqdlbczy
2. Click **"SQL Editor"** in the left sidebar
3. Click **"New query"**
4. Copy and paste this query:

```sql
-- Get all table definitions
SELECT 
    'CREATE TABLE IF NOT EXISTS public.' || table_name || ' (' || 
    string_agg(
        column_name || ' ' || 
        CASE 
            WHEN data_type = 'character varying' THEN 'VARCHAR(' || COALESCE(character_maximum_length::text, '255') || ')'
            WHEN data_type = 'character' THEN 'CHAR(' || character_maximum_length || ')'
            WHEN data_type = 'numeric' THEN 'NUMERIC(' || numeric_precision || ',' || numeric_scale || ')'
            WHEN data_type = 'timestamp with time zone' THEN 'TIMESTAMPTZ'
            WHEN data_type = 'timestamp without time zone' THEN 'TIMESTAMP'
            WHEN data_type = 'uuid' THEN 'UUID'
            WHEN data_type = 'boolean' THEN 'BOOLEAN'
            WHEN data_type = 'integer' THEN 'INTEGER'
            WHEN data_type = 'bigint' THEN 'BIGINT'
            WHEN data_type = 'text' THEN 'TEXT'
            WHEN data_type = 'jsonb' THEN 'JSONB'
            WHEN data_type = 'double precision' THEN 'DOUBLE PRECISION'
            WHEN data_type = 'real' THEN 'REAL'
            WHEN data_type = 'decimal' THEN 'DECIMAL(' || numeric_precision || ',' || numeric_scale || ')'
            ELSE UPPER(data_type)
        END ||
        CASE 
            WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default
            ELSE ''
        END ||
        CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END,
        ', ' ORDER BY ordinal_position
    ) || ');' as create_statement
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name NOT LIKE 'pg_%'
  AND table_name NOT LIKE '_prisma%'
GROUP BY table_schema, table_name
ORDER BY table_name;
```

5. Click **"Run"** (or press Cmd+Enter)
6. Copy all the results
7. Save to `admin-portal/scripts/baseline-migration.sql`

## Step 2: Get Indexes, Functions, and Constraints

Run these additional queries and append to your baseline file:

### Get Indexes:
```sql
SELECT 
    indexdef || ';' as create_index
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

### Get Functions:
```sql
SELECT 
    'CREATE OR REPLACE FUNCTION ' || routine_name || '(...) AS $$' || 
    routine_definition || 
    '$$ LANGUAGE ' || routine_body || ';' as create_function
FROM information_schema.routines
WHERE routine_schema = 'public';
```

### Get Foreign Keys:
```sql
SELECT 
    'ALTER TABLE ' || tc.table_name || 
    ' ADD CONSTRAINT ' || tc.constraint_name ||
    ' FOREIGN KEY (' || kcu.column_name || ')' ||
    ' REFERENCES ' || ccu.table_name || '(' || ccu.column_name || ');' as add_fk
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public';
```

## Step 3: Get RLS Policies

```sql
SELECT 
    'CREATE POLICY "' || policyname || '" ON ' || schemaname || '.' || tablename ||
    ' FOR ' || cmd ||
    ' TO ' || roles ||
    ' USING (' || qual || ')' ||
    CASE WHEN with_check IS NOT NULL THEN ' WITH CHECK (' || with_check || ')' ELSE '' END ||
    ';' as create_policy
FROM pg_policies
WHERE schemaname = 'public';
```

## Step 4: Combine Everything

Combine all the results into one `baseline-migration.sql` file in this order:

1. Tables (from Step 1)
2. Indexes (from Step 2)
3. Functions (from Step 2)
4. Foreign Keys (from Step 2)
5. RLS Policies (from Step 3)

## Alternative: Use pg_dump via Connection String

If you have the database connection string, you can use `pg_dump`:

```bash
pg_dump --schema-only --schema=public \
  --host=db.bsfqomjdjqvqdqdlbczy.supabase.co \
  --port=5432 \
  --username=postgres \
  --dbname=postgres \
  > baseline-migration.sql
```

You'll need to get the connection string from:
Supabase Dashboard > Settings > Database > Connection string

## Quick Alternative: Use Existing Template

Since you already have `tenant-database-template.sql`, you could:

1. Use that as your baseline (it has all the migrations)
2. Test it on the new tenant
3. Fix any issues that come up

This might be faster than extracting from the working tenant!
