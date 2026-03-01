-- Admin Database Structure for Multi-Tenant SaaS
-- 
-- IMPORTANT: This migration MUST be run in a SEPARATE Supabase project (Admin Database)
-- DO NOT run this in your tenant databases!
-- 
-- Steps:
-- 1. Create a new Supabase project (e.g., "Turinova Admin")
-- 2. Run this migration in the Admin Database
-- 3. Your current database will become Tenant #1

-- 1. Tenants Registry
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  
  -- Database Connection Info
  supabase_project_id TEXT NOT NULL,
  supabase_url TEXT NOT NULL,
  supabase_anon_key TEXT NOT NULL, -- Should be encrypted in production
  supabase_service_role_key TEXT NOT NULL, -- Should be encrypted in production
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  subscription_status VARCHAR(50) DEFAULT 'trial',
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- 2. Subscription Plans (shared across all tenants, managed in Admin DB)
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

-- 3. Tenant Subscriptions (in Admin DB)
CREATE TABLE IF NOT EXISTS public.tenant_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  status VARCHAR(50) NOT NULL DEFAULT 'trial', -- "trial", "active", "canceled", "expired"
  stripe_subscription_id VARCHAR(255),
  stripe_customer_id VARCHAR(255),
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  trial_end TIMESTAMP WITH TIME ZONE,
  canceled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id) -- One active subscription per tenant
);

-- 4. Tenant Users Mapping (which user belongs to which tenant)
CREATE TABLE IF NOT EXISTS public.tenant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_email VARCHAR(255) NOT NULL, -- Email for lookup
  user_id_in_tenant_db UUID NOT NULL, -- User ID in tenant's auth.users
  role VARCHAR(50) DEFAULT 'user', -- 'owner', 'admin', 'user'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, user_email)
);

-- 5. Admin Users (for admin panel)
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'admin', -- 'admin', 'super_admin'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Admin Actions Log
CREATE TABLE IF NOT EXISTS public.admin_actions_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES public.admin_users(id),
  tenant_id UUID REFERENCES public.tenants(id),
  action_type VARCHAR(100) NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON public.tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_active ON public.tenants(is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_subscription_plans_slug ON public.subscription_plans(slug);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON public.subscription_plans(is_active);
CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_tenant ON public.tenant_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_status ON public.tenant_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_tenant_users_email ON public.tenant_users(user_email);
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant ON public.tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON public.admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_actions_tenant ON public.admin_actions_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin ON public.admin_actions_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_created ON public.admin_actions_log(created_at DESC);

-- RLS Policies (if needed for admin operations)
-- Note: Admin operations typically use service role key, but we add RLS for safety

-- Tenants: Only service role can access (or specific admin users)
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage tenants" ON public.tenants;
CREATE POLICY "Service role can manage tenants"
  ON public.tenants FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Subscription plans: Service role only
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage subscription plans" ON public.subscription_plans;
CREATE POLICY "Service role can manage subscription plans"
  ON public.subscription_plans FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Tenant subscriptions: Service role only
ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage tenant subscriptions" ON public.tenant_subscriptions;
CREATE POLICY "Service role can manage tenant subscriptions"
  ON public.tenant_subscriptions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Tenant users: Service role only
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage tenant users" ON public.tenant_users;
CREATE POLICY "Service role can manage tenant users"
  ON public.tenant_users FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Admin users: Service role only
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage admin users" ON public.admin_users;
CREATE POLICY "Service role can manage admin users"
  ON public.admin_users FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Admin actions log: Service role can insert, admins can read their own
ALTER TABLE public.admin_actions_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage admin actions log" ON public.admin_actions_log;
CREATE POLICY "Service role can manage admin actions log"
  ON public.admin_actions_log FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
