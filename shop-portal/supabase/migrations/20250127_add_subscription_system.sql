-- Subscription System Migration
-- Run this SQL manually in your Supabase SQL Editor

-- Subscription plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  price_monthly DECIMAL(10,2),
  price_yearly DECIMAL(10,2),
  features JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- User subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  status VARCHAR(50) NOT NULL DEFAULT 'trial', -- "trial", "active", "canceled", "expired"
  stripe_subscription_id VARCHAR(255),
  stripe_customer_id VARCHAR(255),
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  trial_end TIMESTAMP,
  canceled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id) -- One active subscription per user
);

-- AI Usage Tracking table
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_type VARCHAR(100) NOT NULL, -- "product_description", "meta_title", "meta_keywords", "meta_description", "url_slug", "category_description"
  product_id UUID REFERENCES shoprenter_products(id),
  category_id UUID,
  tokens_used INTEGER NOT NULL,
  model_used VARCHAR(100),
  cost_estimate DECIMAL(10,6), -- Estimated cost in USD
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_date ON ai_usage_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_feature ON ai_usage_logs(user_id, feature_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_month ON ai_usage_logs(user_id, DATE_TRUNC('month', created_at));
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status, current_period_end);

-- Enable RLS
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscription_plans
CREATE POLICY "Everyone can view active plans"
  ON subscription_plans FOR SELECT
  TO authenticated
  USING (is_active = true);

-- RLS Policies for user_subscriptions
CREATE POLICY "Users can view own subscription"
  ON user_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscription"
  ON user_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription"
  ON user_subscriptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for ai_usage_logs
CREATE POLICY "Users can view own usage"
  ON ai_usage_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage"
  ON ai_usage_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Insert default subscription plans
INSERT INTO subscription_plans (name, slug, price_monthly, price_yearly, features, display_order) VALUES
  (
    'Starter',
    'starter',
    0,
    0,
    '{"ai_generation": false, "analytics": false}'::jsonb,
    1
  ),
  (
    'Pro',
    'pro',
    29.99,
    299.99,
    '{"ai_generation": true, "analytics": true, "ai_monthly_limit": 10000}'::jsonb,
    2
  ),
  (
    'Enterprise',
    'enterprise',
    99.99,
    999.99,
    '{"ai_generation": true, "analytics": true, "ai_monthly_limit": null}'::jsonb,
    3
  )
ON CONFLICT (slug) DO NOTHING;

-- Grant permissions
GRANT SELECT ON subscription_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_subscriptions TO authenticated;
GRANT SELECT, INSERT ON ai_usage_logs TO authenticated;

-- Function to get current month AI usage for a user
CREATE OR REPLACE FUNCTION get_user_ai_usage_current_month(user_uuid UUID)
RETURNS TABLE (
  total_tokens INTEGER,
  total_cost DECIMAL(10,6),
  usage_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(tokens_used), 0)::INTEGER as total_tokens,
    COALESCE(SUM(cost_estimate), 0) as total_cost,
    COUNT(*) as usage_count
  FROM ai_usage_logs
  WHERE user_id = user_uuid
    AND created_at >= DATE_TRUNC('month', NOW())
    AND created_at < DATE_TRUNC('month', NOW()) + INTERVAL '1 month';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user subscription with plan details
CREATE OR REPLACE FUNCTION get_user_subscription_with_plan(user_uuid UUID)
RETURNS TABLE (
  subscription_id UUID,
  plan_id UUID,
  plan_name VARCHAR,
  plan_slug VARCHAR,
  status VARCHAR,
  current_period_end TIMESTAMP,
  features JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    us.id as subscription_id,
    sp.id as plan_id,
    sp.name as plan_name,
    sp.slug as plan_slug,
    us.status,
    us.current_period_end,
    sp.features
  FROM user_subscriptions us
  JOIN subscription_plans sp ON us.plan_id = sp.id
  WHERE us.user_id = user_uuid
    AND us.status IN ('trial', 'active')
  ORDER BY us.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
