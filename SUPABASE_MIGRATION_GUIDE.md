# Supabase Migration Guide

This guide explains how to properly push database migrations to Supabase for the ERP Turinova project.

## Prerequisites

1. **Supabase CLI installed**: Make sure you have the Supabase CLI installed
2. **Environment configured**: Ensure your `.env.local` file has the correct Supabase credentials
3. **Remote database access**: You need access to the remote Supabase instance

## Environment Configuration

Your `.env.local` file should contain:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://xgkaviefifbllbmfbyfe.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

## Migration Process

### 1. Create Migration Files

Migration files should be placed in `supabase/migrations/` with the naming pattern:
```
YYYYMMDDHHMMSS_migration_name.sql
```

Example: `20250913070000_create_tenant_company_table.sql`

### 2. Migration File Structure

Each migration file should follow this structure:

```sql
-- Create table
CREATE TABLE IF NOT EXISTS table_name (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- other columns
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Add constraints
ALTER TABLE table_name ADD CONSTRAINT constraint_name UNIQUE (column_name);

-- Add indexes
CREATE INDEX IF NOT EXISTS index_name ON table_name(column_name) WHERE deleted_at IS NULL;

-- Create trigger for updated_at
CREATE TRIGGER update_table_name_updated_at
    BEFORE UPDATE ON table_name
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data (optional)
INSERT INTO table_name (column1, column2) VALUES 
    ('value1', 'value2')
ON CONFLICT (column_name) DO NOTHING;
```

### 3. Push Migration to Remote Database

Run the following command to push migrations to the remote Supabase database:

```bash
npx supabase db push
```

This command will:
- Connect to the remote Supabase database
- Show you which migrations will be applied
- Ask for confirmation before applying changes
- Execute the migrations in order

### 4. Common Issues and Solutions

#### Issue: "Could not find the table in the schema cache"
**Solution**: The migration hasn't been applied yet. Run `npx supabase db push` to apply pending migrations.

#### Issue: "ON CONFLICT does not support deferrable unique constraints"
**Solution**: Remove `DEFERRABLE INITIALLY DEFERRED` from unique constraints:

```sql
-- Wrong
ALTER TABLE table_name ADD CONSTRAINT constraint_name 
UNIQUE (column_name) DEFERRABLE INITIALLY DEFERRED;

-- Correct
ALTER TABLE table_name ADD CONSTRAINT constraint_name 
UNIQUE (column_name);
```

#### Issue: "there is no unique or exclusion constraint matching the ON CONFLICT specification"
**Solution**: Make sure the constraint exists before using it in ON CONFLICT:

```sql
-- First create the constraint
ALTER TABLE table_name ADD CONSTRAINT constraint_name UNIQUE (column_name);

-- Then use it in INSERT
INSERT INTO table_name (column1, column2) VALUES 
    ('value1', 'value2')
ON CONFLICT ON CONSTRAINT constraint_name DO NOTHING;
```

### 5. Verification

After pushing migrations, verify they were applied correctly:

1. **Check API endpoints**: Test your API endpoints to ensure they can access the new tables
2. **Check Supabase dashboard**: Log into your Supabase dashboard to verify the tables exist
3. **Test functionality**: Use your application to ensure everything works as expected

### 6. Example: Tenant Company Table Migration

Here's the complete migration that was successfully applied:

```sql
-- Create tenant_company table
CREATE TABLE IF NOT EXISTS tenant_company (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    country VARCHAR,
    postal_code VARCHAR,
    city VARCHAR,
    address VARCHAR,
    phone_number VARCHAR,
    email VARCHAR,
    website VARCHAR,
    tax_number VARCHAR,
    company_registration_number VARCHAR,
    vat_id VARCHAR,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Add unique constraint on name
ALTER TABLE tenant_company ADD CONSTRAINT tenant_company_name_unique_active 
UNIQUE (name);

-- Add index for better performance when filtering out deleted records
CREATE INDEX IF NOT EXISTS ix_tenant_company_deleted_at ON tenant_company(deleted_at) WHERE deleted_at IS NULL;

-- Create trigger for tenant_company table to automatically update updated_at
CREATE TRIGGER update_tenant_company_updated_at
    BEFORE UPDATE ON tenant_company
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data
INSERT INTO tenant_company (
    name, 
    country, 
    postal_code, 
    city, 
    address, 
    phone_number, 
    email, 
    website, 
    tax_number, 
    company_registration_number, 
    vat_id
) VALUES 
    (
        'Turinova Kft.',
        'Magyarország',
        '6000',
        'Kecskemét',
        'Mindszenti krt. 10.',
        '+36 30 999 2800',
        'info@turinova.hu',
        'https://turinova.hu',
        '12345678-1-02',
        '01-09-999999',
        'HU12345678'
    )
ON CONFLICT ON CONSTRAINT tenant_company_name_unique_active DO NOTHING;
```

## Best Practices

1. **Always test migrations locally first** (if possible with Docker)
2. **Use descriptive migration names** that explain what the migration does
3. **Include rollback instructions** in comments for complex migrations
4. **Use IF NOT EXISTS** clauses to make migrations idempotent
5. **Test API endpoints** after applying migrations
6. **Keep migrations small and focused** on single changes when possible

## Troubleshooting

If you encounter issues:

1. **Check Supabase status**: `npx supabase status`
2. **Verify environment variables**: Ensure your `.env.local` is correct
3. **Check migration file syntax**: Validate SQL syntax
4. **Review Supabase logs**: Check the Supabase dashboard for error logs
5. **Test API endpoints**: Use curl or your application to test the new functionality

## Commands Reference

```bash
# Push migrations to remote database
npx supabase db push

# Check Supabase status
npx supabase status

# Reset local database (requires Docker)
npx supabase db reset

# Generate new migration
npx supabase migration new migration_name
```
