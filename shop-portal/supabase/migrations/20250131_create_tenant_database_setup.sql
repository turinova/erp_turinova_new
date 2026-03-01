-- Tenant Database Setup
-- 
-- IMPORTANT: This migration should be run in EACH tenant database (including your current database)
-- This prepares the tenant database to work with the multi-tenant system
--
-- For your current database (which becomes Tenant #1):
-- 1. Run this migration in your current Supabase project
-- 2. This adds the subscription_plans table (needed for tenant subscriptions)
-- 3. This ensures the database is ready to be registered as a tenant

-- 1. Subscription Plans Table (needed for tenant subscriptions)
-- Note: Plans are managed in Admin DB, but we keep a copy here for reference
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  price_monthly DECIMAL(10,2),
  price_yearly DECIMAL(10,2),
  features JSONB DEFAULT '{}',
  ai_credits_per_month INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add tenant_id column to ai_usage_logs (for future tenant-level aggregation)
-- Note: This is optional but recommended for better tracking
ALTER TABLE public.ai_usage_logs 
ADD COLUMN IF NOT EXISTS tenant_id UUID;

-- 3. Create index for tenant_id in ai_usage_logs
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_tenant_id 
ON public.ai_usage_logs(tenant_id) 
WHERE tenant_id IS NOT NULL;

-- 4. Ensure users table exists (should already exist from permission system)
-- This is just a safety check
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  last_sign_in_at timestamp with time zone,
  deleted_at timestamp with time zone
);

-- Note: This migration prepares the tenant database.
-- The actual tenant registration happens in the Admin Database.
