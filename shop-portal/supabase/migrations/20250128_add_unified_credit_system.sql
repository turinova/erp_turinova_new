-- Unified Credit System for AI Features
-- This migration adds credit-based limits for all AI features (generation + competitor scraping)

-- 1. Add ai_credits_per_month to subscription_plans
ALTER TABLE subscription_plans 
ADD COLUMN IF NOT EXISTS ai_credits_per_month INTEGER DEFAULT 0;

-- 2. Add credits_used and credit_type to ai_usage_logs
ALTER TABLE ai_usage_logs 
ADD COLUMN IF NOT EXISTS credits_used INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS credit_type VARCHAR(50) DEFAULT 'ai_generation'; -- 'ai_generation', 'competitor_scrape'

-- 3. Update subscription plans with credit limits
UPDATE subscription_plans 
SET ai_credits_per_month = 0 
WHERE slug = 'starter';

UPDATE subscription_plans 
SET ai_credits_per_month = 200 
WHERE slug = 'pro'; -- ~40 descriptions or 200 meta fields or 100 competitor scrapes

UPDATE subscription_plans 
SET ai_credits_per_month = 1000 
WHERE slug = 'enterprise'; -- ~200 descriptions or 1000 meta fields or 500 competitor scrapes

-- 4. Create index for credit usage queries
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_month_credits 
ON ai_usage_logs(user_id, DATE_TRUNC('month', created_at), credits_used);

-- 5. Create function to get current month credit usage
CREATE OR REPLACE FUNCTION get_user_credit_usage_current_month(user_uuid UUID)
RETURNS TABLE (
  total_credits_used INTEGER,
  total_tokens INTEGER,
  total_cost DECIMAL(10,6),
  usage_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(credits_used), 0)::INTEGER as total_credits_used,
    COALESCE(SUM(tokens_used), 0)::INTEGER as total_tokens,
    COALESCE(SUM(cost_estimate), 0) as total_cost,
    COUNT(*) as usage_count
  FROM ai_usage_logs
  WHERE user_id = user_uuid
    AND created_at >= DATE_TRUNC('month', NOW())
    AND created_at < DATE_TRUNC('month', NOW()) + INTERVAL '1 month';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create view for credit usage (for easier queries)
CREATE OR REPLACE VIEW ai_credit_usage_current_month AS
SELECT 
  user_id,
  DATE_TRUNC('month', created_at) as month,
  SUM(credits_used) as total_credits_used,
  SUM(tokens_used) as total_tokens,
  SUM(cost_estimate) as total_cost,
  COUNT(*) as usage_count,
  COUNT(DISTINCT feature_type) as feature_types_count
FROM ai_usage_logs
WHERE created_at >= DATE_TRUNC('month', NOW())
  AND created_at < DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
GROUP BY user_id, DATE_TRUNC('month', created_at);

-- 7. Grant permissions
GRANT SELECT ON ai_credit_usage_current_month TO authenticated;

-- 8. Add competitor_limits to subscription_plans (for competitor tracking limits)
ALTER TABLE subscription_plans 
ADD COLUMN IF NOT EXISTS competitor_limits JSONB DEFAULT '{}';

-- Update plans with competitor limits
UPDATE subscription_plans 
SET competitor_limits = '{"max_competitors": 0, "max_product_links": 0}'::jsonb
WHERE slug = 'starter';

UPDATE subscription_plans 
SET competitor_limits = '{"max_competitors": 1, "max_product_links": 500}'::jsonb
WHERE slug = 'pro';

UPDATE subscription_plans 
SET competitor_limits = '{"max_competitors": 3, "max_product_links": 2000}'::jsonb
WHERE slug = 'enterprise';

-- Note: Enterprise+ would have unlimited, but we don't have that plan yet
