# Tenant Database Template

This directory contains the consolidated database template for new tenant databases.

## Files

- `tenant-database-template.sql` - Complete database schema for new tenants (3,536 lines)
- `migration-list.txt` - List of all migrations included in the template
- `generate-template.sh` - Script to regenerate the template from migrations

## Quick Start

### For New Tenants

1. **Create a new Supabase project**
   - Go to [Supabase Dashboard](https://supabase.com/dashboard)
   - Click "New Project"
   - Fill in project details and create

2. **Set up the database**
   - Open the SQL Editor in your new Supabase project
   - Copy the entire contents of `tenant-database-template.sql`
   - Paste and run the SQL script
   - Wait for execution to complete (may take 1-2 minutes)

3. **Verify setup**
   - Check that tables were created (users, products, webshop_connections, etc.)
   - Verify RLS policies are enabled
   - Test creating a user in Auth

4. **Register tenant in Admin Panel**
   - Go to Admin Panel → Ügyfelek → Új ügyfél
   - Fill in tenant details and Supabase credentials
   - Test connection
   - Create tenant

## Migration Tracking System

The Admin Database tracks which migrations have been applied to each tenant.

### Setup Migration Tracking

1. Run the migration tracking setup in your **Admin Database**:
   ```sql
   -- Run: shop-portal/supabase/migrations/20250307_create_tenant_migration_tracking.sql
   ```

2. When you create a new tenant using the template, all current migrations are automatically marked as applied.

### Checking Migration Status

You can check which migrations a tenant has applied:

```sql
-- In Admin Database
SELECT * FROM get_tenant_pending_migrations('tenant-uuid-here');
```

### Manual Migration Application

When you add new features that require database changes:

1. **Create migration file** in `shop-portal/supabase/migrations/`
   - Use format: `YYYYMMDD_description.sql`
   - Test on development tenant first

2. **Update template**
   - Run `./generate-template.sh` to regenerate template
   - New migrations are automatically included

3. **Apply to existing tenants**
   - Copy the new migration SQL
   - Run it in each existing tenant's database
   - Mark as applied in Admin DB:
     ```sql
     INSERT INTO tenant_migrations (tenant_id, migration_name)
     VALUES ('tenant-uuid', '20250307_new_migration_name')
     ON CONFLICT DO NOTHING;
     ```

## Template Contents

The template includes:

- ✅ Permission system (users, pages, permissions)
- ✅ Webshop connections (ShopRenter, etc.)
- ✅ Products & descriptions
- ✅ Categories
- ✅ VAT management
- ✅ Competitor tracking
- ✅ AI description generation
- ✅ Search Console integration
- ✅ Product images & alt text
- ✅ Quality scores
- ✅ Subscription & credit system
- ✅ All RLS policies
- ✅ Indexes for performance
- ✅ Helper functions

## Excluded Migrations

These migrations are **NOT** included (Admin DB or one-time setup):

- Admin database structure
- Tenant subscription management (Admin DB)
- Credit usage logs (Admin DB)
- User mapping (one-time setup)
- Test override policies (development only)

## Regenerating the Template

When you add new migrations:

```bash
cd admin-portal/database-templates
./generate-template.sh
```

This will:
- Read all migrations from `shop-portal/supabase/migrations/`
- Exclude admin/one-time migrations
- Combine them in chronological order
- Generate `tenant-database-template.sql`

## Best Practices

1. **Always test migrations** on a development tenant first
2. **Keep migration list updated** in `migration-list.txt`
3. **Document breaking changes** in migration files
4. **Use IF NOT EXISTS** in migrations to make them idempotent
5. **Test template** on a fresh Supabase project before using for production tenants

## Troubleshooting

**Template too large?**
- The template is ~3,500 lines - this is normal
- Supabase SQL Editor can handle it
- If issues, split into sections and run sequentially

**Migration tracking not working?**
- Ensure migration tracking system is set up in Admin DB
- Check that `tenant_migrations` table exists
- Verify RLS policies allow admin access

**Missing tables after running template?**
- Check for errors in SQL Editor
- Verify all migrations ran successfully
- Some migrations depend on others - ensure order is correct
