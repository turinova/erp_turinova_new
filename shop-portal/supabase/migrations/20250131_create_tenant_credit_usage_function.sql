-- Create RPC function for tenant-level credit usage aggregation
-- Run this in your TENANT DATABASE (bsfqomjdjqvqdqdlbczy.supabase.co)
-- This function bypasses RLS to aggregate all tenant usage

CREATE OR REPLACE FUNCTION public.get_tenant_credit_usage_current_month()
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
  FROM public.ai_usage_logs
  WHERE created_at >= DATE_TRUNC('month', NOW())
    AND created_at < DATE_TRUNC('month', NOW()) + INTERVAL '1 month';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_tenant_credit_usage_current_month() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_credit_usage_current_month() TO anon;
