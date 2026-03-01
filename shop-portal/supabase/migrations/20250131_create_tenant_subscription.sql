-- Create Subscription Plans and Tenant Subscription
-- 
-- IMPORTANT: This script creates subscription plans and assigns a subscription to your tenant
-- Run this in the ADMIN DATABASE after:
-- 1. Admin database structure is set up (20250131_create_admin_database_structure.sql)
-- 2. Tenant is registered (20250131_create_default_tenant.sql)
--
-- This creates default subscription plans (if they don't exist) and assigns one to your tenant

-- Create default subscription plans (if they don't exist)
INSERT INTO public.subscription_plans (
  name,
  slug,
  price_monthly,
  price_yearly,
  features,
  ai_credits_per_month,
  is_active,
  display_order
)
SELECT 
  'Free Plan',
  'free',
  0,
  0,
  '{"ai_generation": false, "analytics": false}'::jsonb,
  0,
  true,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscription_plans WHERE slug = 'free'
);

INSERT INTO public.subscription_plans (
  name,
  slug,
  price_monthly,
  price_yearly,
  features,
  ai_credits_per_month,
  is_active,
  display_order
)
SELECT 
  'Pro Plan',
  'pro',
  9900, -- 99 HUF per month (example)
  99000, -- 990 HUF per year (example)
  '{"ai_generation": true, "analytics": true}'::jsonb,
  1000, -- 1000 credits per month
  true,
  1
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscription_plans WHERE slug = 'pro'
);

-- Create subscription for tenant
-- Replace 'tenant-1' with your actual tenant slug
-- Replace 'pro' with the plan slug you want to assign

DO $$
DECLARE
  tenant_uuid UUID;
  plan_uuid UUID;
BEGIN
  -- Get tenant ID
  SELECT id INTO tenant_uuid
  FROM public.tenants
  WHERE slug = 'tenant-1' -- Replace with your actual tenant slug
  LIMIT 1;

  IF tenant_uuid IS NULL THEN
    RAISE EXCEPTION 'Tenant with slug "tenant-1" not found. Please create the tenant first using 20250131_create_default_tenant.sql';
  END IF;

  -- Get plan ID
  SELECT id INTO plan_uuid
  FROM public.subscription_plans
  WHERE slug = 'pro' -- Replace with your desired plan slug
  LIMIT 1;

  IF plan_uuid IS NULL THEN
    RAISE EXCEPTION 'Subscription plan with slug "pro" not found. Please create subscription plans first.';
  END IF;

  -- Create subscription if it doesn't exist
  INSERT INTO public.tenant_subscriptions (
    tenant_id,
    plan_id,
    status,
    current_period_start,
    current_period_end,
    created_at
  )
  SELECT 
    tenant_uuid,
    plan_uuid,
    'active',
    NOW(),
    NOW() + INTERVAL '1 month',
    NOW()
  WHERE NOT EXISTS (
    SELECT 1 FROM public.tenant_subscriptions 
    WHERE tenant_id = tenant_uuid
  );

  IF FOUND THEN
    RAISE NOTICE 'Subscription created successfully for tenant "tenant-1" with plan "pro"';
  ELSE
    RAISE NOTICE 'Subscription already exists for tenant "tenant-1"';
  END IF;
END $$;
