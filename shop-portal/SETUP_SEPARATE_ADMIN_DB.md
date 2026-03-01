# Setup Guide: Separate Admin Database

This guide walks you through setting up the multi-tenant SaaS system with a **separate admin database** from the start.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  ADMIN DATABASE (NEW Supabase Project)                      │
│  ├── tenants (Tenant registry)                              │
│  ├── tenant_subscriptions                                    │
│  ├── tenant_users                                            │
│  ├── subscription_plans                                       │
│  ├── admin_users                                             │
│  └── admin_actions_log                                       │
└─────────────────────────────────────────────────────────────┘
                        │
                        │ (lookup tenant DB)
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  TENANT DATABASE #1 (Your Current Supabase Project)        │
│  ├── auth.users                                              │
│  ├── webshop_connections                                     │
│  ├── shoprenter_products                                    │
│  ├── ai_usage_logs                                          │
│  └── All your existing data                                 │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

- Access to Supabase dashboard
- Your current Supabase project connection details:
  - Project URL
  - Anon Key
  - Service Role Key
  - Project ID

## Step-by-Step Setup

### Step 1: Create Admin Database

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click **"New Project"**
3. Name it: `Turinova Admin` (or similar)
4. Set a database password
5. Choose a region
6. Click **"Create new project"**
7. Wait for the project to be created

### Step 2: Run Admin Database Migrations

1. In your **Admin Database** project, go to **SQL Editor**
2. Run the following migrations in order:

   **Migration 1: Admin Database Structure**
   ```sql
   -- Copy and paste the contents of:
   -- shop-portal/supabase/migrations/20250131_create_admin_database_structure.sql
   ```

   **Migration 2: Subscription Plans**
   ```sql
   -- Copy and paste the contents of:
   -- shop-portal/supabase/migrations/20250131_create_tenant_subscription.sql
   -- (This creates the subscription plans)
   ```

### Step 3: Prepare Your Current Database (Tenant #1)

1. In your **Current Database** project, go to **SQL Editor**
2. Run the tenant database setup:

   ```sql
   -- Copy and paste the contents of:
   -- shop-portal/supabase/migrations/20250131_create_tenant_database_setup.sql
   ```

### Step 4: Register Your Current Database as Tenant #1

1. In your **Admin Database** project, go to **SQL Editor**
2. Run the tenant registration:

   ```sql
   -- Copy and paste the contents of:
   -- shop-portal/supabase/migrations/20250131_create_default_tenant.sql
   ```

3. **IMPORTANT:** After running, you MUST update the tenant record with your actual connection details:

   ```sql
   UPDATE public.tenants
   SET 
     supabase_project_id = 'your-current-project-id', -- From your current Supabase project settings
     supabase_url = 'https://your-current-project.supabase.co', -- Your current NEXT_PUBLIC_SUPABASE_URL
     supabase_anon_key = 'your-current-anon-key', -- Your current NEXT_PUBLIC_SUPABASE_ANON_KEY
     supabase_service_role_key = 'your-current-service-role-key' -- Your current SUPABASE_SERVICE_ROLE_KEY
   WHERE slug = 'tenant-1';
   ```

   **How to find these values:**
   - Go to your **Current Database** project in Supabase
   - Go to **Settings** → **API**
   - Copy:
     - **Project URL** → `supabase_url`
     - **anon/public key** → `supabase_anon_key`
     - **service_role key** → `supabase_service_role_key`
   - **Project ID** is in the URL: `https://[PROJECT_ID].supabase.co`

### Step 5: Map Users to Tenant

1. Get user emails and IDs from your **Current Database**:

   ```sql
   -- Run this in your CURRENT DATABASE (Tenant #1)
   SELECT 
     id,
     email,
     created_at
   FROM auth.users
   ORDER BY created_at;
   ```

2. In your **Admin Database**, map each user:

   ```sql
   -- Run this in your ADMIN DATABASE
   -- Replace the values for each user
   INSERT INTO public.tenant_users (
     tenant_id,
     user_email,
     user_id_in_tenant_db,
     role,
     created_at
   )
   VALUES (
     (SELECT id FROM public.tenants WHERE slug = 'tenant-1'),
     'user@example.com', -- User email from step 1
     'user-uuid-here', -- User ID from step 1
     'user', -- or 'owner' for the first user
     NOW()
   )
   ON CONFLICT (tenant_id, user_email) DO NOTHING;
   ```

   **Repeat for each user** in your current database.

### Step 6: Create Subscription for Tenant

1. In your **Admin Database**, create a subscription:

   ```sql
   -- Run this in your ADMIN DATABASE
   -- This assigns the 'pro' plan to your tenant
   INSERT INTO public.tenant_subscriptions (
     tenant_id,
     plan_id,
     status,
     current_period_start,
     current_period_end
   )
   SELECT 
     (SELECT id FROM public.tenants WHERE slug = 'tenant-1'),
     (SELECT id FROM public.subscription_plans WHERE slug = 'pro' LIMIT 1),
     'active',
     NOW(),
     NOW() + INTERVAL '1 month'
   WHERE NOT EXISTS (
     SELECT 1 FROM public.tenant_subscriptions 
     WHERE tenant_id = (SELECT id FROM public.tenants WHERE slug = 'tenant-1')
   );
   ```

### Step 7: Update Environment Variables

Update your `.env.local` file in the `shop-portal` directory:

```env
# Admin Database
ADMIN_SUPABASE_URL=https://your-admin-project.supabase.co
ADMIN_SUPABASE_ANON_KEY=your-admin-anon-key

# Tenant Database (Current Database - for fallback and tenant operations)
NEXT_PUBLIC_SUPABASE_URL=https://your-current-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-current-anon-key

# Service Role Keys (for server-side operations)
SUPABASE_SERVICE_ROLE_KEY=your-current-service-role-key
ADMIN_SUPABASE_SERVICE_ROLE_KEY=your-admin-service-role-key
```

**How to find Admin Database values:**
- Go to your **Admin Database** project in Supabase
- Go to **Settings** → **API**
- Copy:
  - **Project URL** → `ADMIN_SUPABASE_URL`
  - **anon/public key** → `ADMIN_SUPABASE_ANON_KEY`
  - **service_role key** → `ADMIN_SUPABASE_SERVICE_ROLE_KEY`

### Step 8: Test the System

1. **Restart your dev server:**
   ```bash
   cd shop-portal
   npm run dev
   ```

2. **Test login:**
   - Go to `http://localhost:3000/login`
   - Login with a user you mapped in Step 5
   - Should successfully authenticate and redirect

3. **Verify tenant context:**
   - Check browser cookies for `tenant_context`
   - Should contain tenant information

4. **Test subscription:**
   - Go to `http://localhost:3000/subscription`
   - Should show tenant-level subscription

## Verification Queries

### Check Tenant Registration (Admin DB)

```sql
-- Run in ADMIN DATABASE
SELECT 
  id,
  name,
  slug,
  is_active,
  subscription_status,
  created_at
FROM public.tenants
WHERE slug = 'tenant-1';
```

### Check User Mapping (Admin DB)

```sql
-- Run in ADMIN DATABASE
SELECT 
  tu.user_email,
  tu.role,
  t.name as tenant_name
FROM public.tenant_users tu
JOIN public.tenants t ON t.id = tu.tenant_id
WHERE t.slug = 'tenant-1';
```

### Check Subscription (Admin DB)

```sql
-- Run in ADMIN DATABASE
SELECT 
  ts.status,
  ts.current_period_end,
  sp.name as plan_name,
  sp.ai_credits_per_month
FROM public.tenant_subscriptions ts
JOIN public.tenants t ON t.id = ts.tenant_id
JOIN public.subscription_plans sp ON sp.id = ts.plan_id
WHERE t.slug = 'tenant-1';
```

## Troubleshooting

### "No tenant context found"

**Cause:** User not mapped to tenant or tenant context cookie not set.

**Solution:**
1. Verify user is in `tenant_users` table (Admin DB)
2. Check tenant record has correct connection details
3. Re-login to establish tenant context

### "User not found in any tenant"

**Cause:** User email not in `tenant_users` table.

**Solution:**
```sql
-- Run in ADMIN DATABASE
-- Add missing user
INSERT INTO public.tenant_users (
  tenant_id,
  user_email,
  user_id_in_tenant_db,
  role
)
SELECT 
  (SELECT id FROM public.tenants WHERE slug = 'tenant-1'),
  'user@example.com',
  'user-uuid-from-tenant-db',
  'user'
WHERE NOT EXISTS (
  SELECT 1 FROM public.tenant_users 
  WHERE user_email = 'user@example.com'
);
```

### "Subscription not found"

**Cause:** No `tenant_subscription` record for tenant.

**Solution:**
```sql
-- Run in ADMIN DATABASE
-- Create subscription
INSERT INTO public.tenant_subscriptions (
  tenant_id,
  plan_id,
  status,
  current_period_start,
  current_period_end
)
SELECT 
  (SELECT id FROM public.tenants WHERE slug = 'tenant-1'),
  (SELECT id FROM public.subscription_plans WHERE slug = 'pro' LIMIT 1),
  'active',
  NOW(),
  NOW() + INTERVAL '1 month'
WHERE NOT EXISTS (
  SELECT 1 FROM public.tenant_subscriptions 
  WHERE tenant_id = (SELECT id FROM public.tenants WHERE slug = 'tenant-1')
);
```

## Next Steps

After setup is complete:

1. ✅ Test login flow
2. ✅ Test subscription access
3. ✅ Test credit usage tracking
4. ⏳ Update remaining API routes to use `getTenantSupabase()`
5. ⏳ Create admin panel UI (future)

## Support

If you encounter issues:

1. Check the verification queries above
2. Check browser console for errors
3. Check server logs for authentication errors
4. Verify environment variables are set correctly
5. Verify tenant connection details in Admin DB
