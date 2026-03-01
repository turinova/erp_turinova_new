# Multi-Tenant SaaS Implementation Guide

## Overview

This document describes the multi-tenant SaaS architecture implementation with separate databases for each tenant. The system uses:

1. **Admin Database** - Manages tenants, subscriptions, and admin operations
2. **Tenant Databases** - Separate Supabase projects for each tenant's data

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  ADMIN DATABASE (Separate Supabase Project)                │
│  ├── tenants (Tenant registry)                              │
│  ├── tenant_subscriptions (Tenant-level subscriptions)      │
│  ├── tenant_users (User-to-tenant mapping)                  │
│  ├── subscription_plans (Shared plans)                      │
│  ├── admin_users (Admin panel users)                         │
│  └── admin_actions_log (Audit log)                          │
└─────────────────────────────────────────────────────────────┘
                        │
                        │ (lookup tenant DB)
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  TENANT DATABASE #1 (Your Current Supabase Project)        │
│  ├── auth.users (Tenant users)                              │
│  ├── webshop_connections                                     │
│  ├── shoprenter_products                                    │
│  ├── ai_usage_logs (tenant-level credits)                   │
│  └── All tenant-specific data                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  TENANT DATABASE #2 (Future Tenant)                         │
│  └── (Separate Supabase Project)                           │
└─────────────────────────────────────────────────────────────┘
```

**Note:** The current database becomes Tenant #1. Each new tenant gets its own separate Supabase project.

## Implementation Status

✅ **Completed:**
- Admin database structure (migrations)
- Default tenant migration
- Tenant helper functions (`getTenantSupabase`, `getAdminSupabase`, `getTenantFromSession`)
- Two-step authentication system
- Login API route
- Updated Login component
- Tenant-based subscription system
- Tenant-based credit usage tracking
- Updated `supabase-server.ts` to use tenant context

⏳ **Pending:**
- Middleware update for tenant context (currently falls back to default)
- Update all API routes to use `getTenantSupabase()` (currently using fallback)
- Manual tenant creation UI (for now, use SQL)
- Admin panel UI (future)

## Setup Instructions

**⚠️ IMPORTANT: This system uses a SEPARATE Admin Database from the start.**

See **[SETUP_SEPARATE_ADMIN_DB.md](./SETUP_SEPARATE_ADMIN_DB.md)** for complete step-by-step setup instructions.

### Quick Overview

1. **Create Admin Database** - New Supabase project
2. **Run Admin Migrations** - In Admin Database
3. **Prepare Current Database** - Run tenant setup migration
4. **Register Current DB as Tenant** - In Admin Database
5. **Map Users** - Link users to tenant
6. **Create Subscription** - Assign plan to tenant
7. **Update Environment Variables** - Add Admin DB credentials

### Step 2: Configure Default Tenant

After running the migrations, you **must** manually update the default tenant with your actual Supabase connection details:

```sql
UPDATE public.tenants
SET 
  supabase_project_id = 'your-project-id', -- Your Supabase project ID
  supabase_url = 'https://your-project.supabase.co', -- Your NEXT_PUBLIC_SUPABASE_URL
  supabase_anon_key = 'your-anon-key', -- Your NEXT_PUBLIC_SUPABASE_ANON_KEY
  supabase_service_role_key = 'your-service-role-key' -- Your SUPABASE_SERVICE_ROLE_KEY
WHERE slug = 'default';
```

### Step 3: Map Existing Users to Default Tenant

The migration should have already mapped existing users, but you can verify:

```sql
-- Check if users are mapped
SELECT 
  tu.user_email,
  tu.role,
  t.name as tenant_name
FROM public.tenant_users tu
JOIN public.tenants t ON t.id = tu.tenant_id
WHERE t.slug = 'default';
```

### Step 4: Migrate Existing Subscription

If you have existing subscriptions, migrate them to tenant-level:

```sql
-- Get default tenant ID
DO $$
DECLARE
  default_tenant_id UUID;
  existing_plan_id UUID;
BEGIN
  -- Get default tenant
  SELECT id INTO default_tenant_id
  FROM public.tenants
  WHERE slug = 'default'
  LIMIT 1;

  -- Get first existing subscription plan (or create default)
  SELECT id INTO existing_plan_id
  FROM public.subscription_plans
  LIMIT 1;

  -- Create tenant subscription if doesn't exist
  IF default_tenant_id IS NOT NULL AND existing_plan_id IS NOT NULL THEN
    INSERT INTO public.tenant_subscriptions (
      tenant_id,
      plan_id,
      status,
      current_period_start,
      current_period_end,
      created_at
    )
    SELECT 
      default_tenant_id,
      existing_plan_id,
      'active',
      NOW(),
      NOW() + INTERVAL '1 month',
      NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM public.tenant_subscriptions 
      WHERE tenant_id = default_tenant_id
    );
  END IF;
END $$;
```

## Environment Variables

### Current Setup (Single Database)
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Future Setup (Separate Admin DB)
```env
# Admin Database
ADMIN_SUPABASE_URL=https://admin-project.supabase.co
ADMIN_SUPABASE_ANON_KEY=admin-anon-key

# Default Tenant Database (for fallback)
NEXT_PUBLIC_SUPABASE_URL=https://tenant-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tenant-anon-key
```

**Note:** For now, both Admin and Tenant databases use the same environment variables (current database). When you create a separate Admin database, update the environment variables accordingly.

## How It Works

### Login Flow

1. **User submits login form** → `/api/auth/login`
2. **Two-step authentication:**
   - Step 1: Lookup tenant in Admin DB (`tenant_users` table)
   - Step 2: Authenticate in Tenant DB
3. **Store tenant context** in cookie (`tenant_context`)
4. **Establish session** in Tenant DB
5. **Redirect** to first permitted page

### API Route Flow

1. **API route called** → Uses `getTenantSupabase()`
2. **Get tenant from session** → Reads `tenant_context` cookie
3. **Create tenant Supabase client** → Connects to tenant's database
4. **Execute query** → All data is tenant-isolated

### Subscription Flow

1. **Get subscription** → `/api/subscription/current`
2. **Lookup in Admin DB** → `tenant_subscriptions` table
3. **Return tenant-level subscription** → All users in tenant share same subscription

### Credit Usage Flow

1. **Get usage** → `/api/subscription/usage`
2. **Aggregate from Tenant DB** → Sum all `ai_usage_logs` for tenant (current month)
3. **Get limit from Admin DB** → From `tenant_subscriptions.plan.ai_credits_per_month`
4. **Return tenant-level credits** → All users in tenant share same credit balance

## Creating New Tenants (Manual)

For now, tenants must be created manually via SQL:

```sql
-- 1. Create tenant record
INSERT INTO public.tenants (
  name,
  slug,
  supabase_project_id,
  supabase_url,
  supabase_anon_key,
  supabase_service_role_key,
  is_active,
  subscription_status
)
VALUES (
  'New Tenant Name',
  'new-tenant-slug',
  'new-project-id',
  'https://new-tenant.supabase.co',
  'new-tenant-anon-key',
  'new-tenant-service-key',
  true,
  'trial'
)
RETURNING id;

-- 2. Create subscription for tenant
INSERT INTO public.tenant_subscriptions (
  tenant_id,
  plan_id,
  status,
  current_period_start,
  current_period_end
)
SELECT 
  (SELECT id FROM public.tenants WHERE slug = 'new-tenant-slug'),
  (SELECT id FROM public.subscription_plans WHERE slug = 'free' LIMIT 1),
  'trial',
  NOW(),
  NOW() + INTERVAL '14 days'
RETURNING id;

-- 3. Add users to tenant (after they're created in tenant DB)
INSERT INTO public.tenant_users (
  tenant_id,
  user_email,
  user_id_in_tenant_db,
  role
)
VALUES (
  (SELECT id FROM public.tenants WHERE slug = 'new-tenant-slug'),
  'user@example.com',
  'user-uuid-from-tenant-db-auth.users',
  'user'
);
```

## Testing

### Test Login Flow

1. **Start dev server:**
   ```bash
   cd shop-portal
   npm run dev
   ```

2. **Navigate to login:**
   ```
   http://localhost:3000/login
   ```

3. **Login with existing user:**
   - Should lookup tenant in Admin DB
   - Should authenticate in Tenant DB
   - Should store tenant context
   - Should redirect to first permitted page

### Test Subscription

1. **Check subscription:**
   ```bash
   curl http://localhost:3000/api/subscription/current \
     -H "Cookie: your-session-cookie"
   ```

2. **Should return:**
   - Tenant-level subscription from Admin DB
   - Plan details with `ai_credits_per_month`

### Test Credit Usage

1. **Check usage:**
   ```bash
   curl http://localhost:3000/api/subscription/usage \
     -H "Cookie: your-session-cookie"
   ```

2. **Should return:**
   - Tenant-level credit usage (sum of all users in tenant)
   - Credit limit from subscription plan

## Migration Notes

### Backward Compatibility

The system maintains backward compatibility:

- `supabaseServer()` falls back to default Supabase if tenant context not found
- Existing API routes continue to work during migration
- Old `user_subscriptions` table still exists (can be removed later)

### Data Migration

- **Users:** Already mapped to default tenant via migration
- **Subscriptions:** Need to manually migrate to `tenant_subscriptions` (see Step 4 above)
- **Credits:** Already tracked in `ai_usage_logs` with `tenant_id` (for future use)

## Next Steps

1. **Update Middleware:**
   - Handle tenant context in middleware
   - Ensure tenant cookie is set correctly

2. **Update All API Routes:**
   - Replace `supabaseServer()` with `getTenantSupabase()`
   - Ensure all queries use tenant context

3. **Create Admin Panel:**
   - UI for creating tenants
   - UI for managing subscriptions
   - UI for viewing credit usage

4. **Separate Admin Database:**
   - Create new Supabase project for Admin DB
   - Update environment variables
   - Migrate admin tables to new DB

## Troubleshooting

### "No tenant context found"

**Cause:** Tenant context cookie not set or expired.

**Solution:**
1. Check if user is logged in
2. Check if `tenant_context` cookie exists
3. Re-login to establish tenant context

### "User not found in any tenant"

**Cause:** User email not in `tenant_users` table.

**Solution:**
```sql
-- Add user to default tenant
INSERT INTO public.tenant_users (
  tenant_id,
  user_email,
  user_id_in_tenant_db,
  role
)
SELECT 
  (SELECT id FROM public.tenants WHERE slug = 'default'),
  'user@example.com',
  (SELECT id FROM auth.users WHERE email = 'user@example.com'),
  'user'
WHERE NOT EXISTS (
  SELECT 1 FROM public.tenant_users 
  WHERE user_email = 'user@example.com'
);
```

### Subscription Not Found

**Cause:** No `tenant_subscription` record for tenant.

**Solution:**
```sql
-- Create subscription for default tenant
INSERT INTO public.tenant_subscriptions (
  tenant_id,
  plan_id,
  status
)
SELECT 
  (SELECT id FROM public.tenants WHERE slug = 'default'),
  (SELECT id FROM public.subscription_plans LIMIT 1),
  'active'
WHERE NOT EXISTS (
  SELECT 1 FROM public.tenant_subscriptions 
  WHERE tenant_id = (SELECT id FROM public.tenants WHERE slug = 'default')
);
```

## Support

For issues or questions, check:
- Migration files in `shop-portal/supabase/migrations/`
- Helper functions in `shop-portal/src/lib/tenant-supabase.ts`
- Authentication logic in `shop-portal/src/lib/auth/central-auth.ts`
