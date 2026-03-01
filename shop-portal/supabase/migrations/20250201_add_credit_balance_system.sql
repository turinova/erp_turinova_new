-- Credit Balance System Migration
-- Run this in your ADMIN DATABASE SQL Editor
-- This adds tenant-specific credit balance fields and token pack system

-- 1. Add credit balance fields to tenant_subscriptions
ALTER TABLE public.tenant_subscriptions 
ADD COLUMN IF NOT EXISTS bonus_credits INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS purchased_credits INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_usage_reset_at TIMESTAMP WITH TIME ZONE;

-- 2. Add reset tracking to tenant_credit_usage_logs
ALTER TABLE public.tenant_credit_usage_logs
ADD COLUMN IF NOT EXISTS is_reset BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS reset_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reset_by_admin_id UUID REFERENCES public.admin_users(id);

-- Create index for reset queries
CREATE INDEX IF NOT EXISTS idx_tenant_credit_usage_reset 
ON public.tenant_credit_usage_logs(tenant_id, is_reset, created_at DESC);

-- 3. Create token_packs table (for user purchases)
CREATE TABLE IF NOT EXISTS public.token_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  credits INTEGER NOT NULL,
  price_huf INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create tenant_credit_purchases table (audit trail)
CREATE TABLE IF NOT EXISTS public.tenant_credit_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  token_pack_id UUID REFERENCES public.token_packs(id),
  credits_purchased INTEGER NOT NULL,
  price_paid_huf INTEGER NOT NULL,
  payment_method VARCHAR(50) DEFAULT 'manual', -- 'stripe', 'manual', 'admin_grant'
  stripe_payment_id VARCHAR(255),
  purchased_by_user_email VARCHAR(255),
  processed_by_admin_id UUID REFERENCES public.admin_users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_token_packs_active ON public.token_packs(is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_tenant_credit_purchases_tenant ON public.tenant_credit_purchases(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_credit_purchases_pack ON public.tenant_credit_purchases(token_pack_id);

-- RLS Policies
ALTER TABLE public.token_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_credit_purchases ENABLE ROW LEVEL SECURITY;

-- Service role can manage token packs
DROP POLICY IF EXISTS "Service role can manage token packs" ON public.token_packs;
CREATE POLICY "Service role can manage token packs"
  ON public.token_packs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Service role can manage credit purchases
DROP POLICY IF EXISTS "Service role can manage credit purchases" ON public.tenant_credit_purchases;
CREATE POLICY "Service role can manage credit purchases"
  ON public.tenant_credit_purchases FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Seed initial token packs (tiered pricing: 50=750, 250=3000, 500=5000)
INSERT INTO public.token_packs (name, credits, price_huf, is_active, display_order)
VALUES 
  ('50 Turitoken', 50, 750, true, 1),
  ('250 Turitoken', 250, 3000, true, 2),
  ('500 Turitoken', 500, 5000, true, 3)
ON CONFLICT DO NOTHING;

-- Update RPC function to exclude reset logs
CREATE OR REPLACE FUNCTION public.get_tenant_credit_usage_current_month(tenant_uuid UUID)
RETURNS TABLE (
  total_credits_used INTEGER,
  total_tokens_used INTEGER,
  total_cost DECIMAL(10,6),
  usage_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(credits_used), 0)::INTEGER as total_credits_used,
    COALESCE(SUM(tokens_used), 0)::INTEGER as total_tokens_used,
    COALESCE(SUM(cost_estimate), 0) as total_cost,
    COUNT(*) as usage_count
  FROM public.tenant_credit_usage_logs
  WHERE tenant_id = tenant_uuid
    AND created_at >= DATE_TRUNC('month', NOW())
    AND created_at < DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
    AND (is_reset = false OR is_reset IS NULL); -- Exclude reset logs
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_tenant_credit_usage_current_month(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_credit_usage_current_month(UUID) TO anon;
