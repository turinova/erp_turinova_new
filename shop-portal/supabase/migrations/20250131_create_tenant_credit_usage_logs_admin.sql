-- Create tenant_credit_usage_logs table in ADMIN DATABASE
-- Run this in your Admin Database SQL Editor (ievpajfptwlozpafvjdt.supabase.co)
-- This table stores all credit usage logs centrally, surviving tenant DB restores

CREATE TABLE IF NOT EXISTS public.tenant_credit_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id_in_tenant_db UUID NOT NULL, -- The user's ID in their tenant database
  user_email VARCHAR(255), -- Denormalized for easier queries and reporting
  
  -- Usage details
  feature_type VARCHAR(100) NOT NULL, -- "product_description", "meta_title", "competitor_price_scrape", etc.
  credits_used INTEGER NOT NULL DEFAULT 1,
  credit_type VARCHAR(50) DEFAULT 'ai_generation', -- 'ai_generation', 'competitor_scrape'
  
  -- Product context (stored as JSON since product_id is in tenant DB)
  product_context JSONB DEFAULT '{}', -- {product_id, product_name, sku, etc.}
  
  -- Additional metadata
  tokens_used INTEGER,
  cost_estimate DECIMAL(10,6),
  model_used VARCHAR(100),
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
-- Note: DATE_TRUNC in index requires IMMUTABLE function, so we index on created_at directly
-- The RPC function will handle month filtering efficiently
CREATE INDEX IF NOT EXISTS idx_tenant_credit_usage_tenant_date 
  ON public.tenant_credit_usage_logs(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tenant_credit_usage_tenant_created 
  ON public.tenant_credit_usage_logs(tenant_id, created_at);

CREATE INDEX IF NOT EXISTS idx_tenant_credit_usage_user 
  ON public.tenant_credit_usage_logs(tenant_id, user_id_in_tenant_db, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tenant_credit_usage_feature 
  ON public.tenant_credit_usage_logs(tenant_id, feature_type, created_at DESC);

-- Enable RLS
ALTER TABLE public.tenant_credit_usage_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role can manage all logs
DROP POLICY IF EXISTS "Service role can manage credit usage logs" ON public.tenant_credit_usage_logs;
CREATE POLICY "Service role can manage credit usage logs"
  ON public.tenant_credit_usage_logs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- RPC Function: Get tenant credit usage for current month
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
    AND created_at < DATE_TRUNC('month', NOW()) + INTERVAL '1 month';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_tenant_credit_usage_current_month(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_credit_usage_current_month(UUID) TO anon;
