-- Test subscription lookup in your ADMIN DATABASE
-- Run this in your Admin Database SQL Editor (ievpajfptwlozpafvjdt.supabase.co)

-- 1. Check if tenant exists
SELECT 
  id,
  name,
  slug,
  is_active
FROM public.tenants
WHERE slug = 'tenant-1';

-- 2. Check if subscription exists for tenant-1
SELECT 
  ts.id,
  ts.tenant_id,
  ts.plan_id,
  ts.status,
  ts.current_period_start,
  ts.current_period_end,
  sp.name as plan_name,
  sp.slug as plan_slug,
  sp.ai_credits_per_month
FROM public.tenant_subscriptions ts
JOIN public.subscription_plans sp ON sp.id = ts.plan_id
JOIN public.tenants t ON t.id = ts.tenant_id
WHERE t.slug = 'tenant-1';

-- 3. Check all subscriptions (any status)
SELECT 
  ts.id,
  ts.tenant_id,
  ts.plan_id,
  ts.status,
  t.slug as tenant_slug,
  sp.name as plan_name
FROM public.tenant_subscriptions ts
JOIN public.subscription_plans sp ON sp.id = ts.plan_id
JOIN public.tenants t ON t.id = ts.tenant_id;

-- 4. Check all subscription plans
SELECT 
  id,
  name,
  slug,
  ai_credits_per_month,
  is_active
FROM public.subscription_plans;
