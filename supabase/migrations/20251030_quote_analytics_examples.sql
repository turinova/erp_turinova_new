-- Example Analytics Queries for Quote Status Timestamps
-- Run these queries after applying 20251030_add_quote_status_timestamps.sql
-- These are examples - customize for your needs

-- ============================================
-- LEAD TIME ANALYTICS
-- ============================================

-- Average time from ordered to ready
SELECT 
  AVG(ready_at - ordered_at) AS avg_production_time,
  COUNT(*) AS completed_orders
FROM quotes
WHERE ready_at IS NOT NULL 
  AND ordered_at IS NOT NULL
  AND deleted_at IS NULL;

-- Average time breakdown by phase
SELECT 
  AVG(in_production_at - ordered_at) AS avg_order_to_production,
  AVG(ready_at - in_production_at) AS avg_production_time,
  AVG(finished_at - ready_at) AS avg_delivery_time,
  AVG(finished_at - ordered_at) AS avg_total_time
FROM quotes
WHERE ordered_at IS NOT NULL
  AND deleted_at IS NULL;

-- ============================================
-- CURRENT MONTH STATISTICS
-- ============================================

-- Orders finished this month
SELECT 
  COUNT(*) AS finished_count,
  SUM(final_total_after_discount) AS total_revenue
FROM quotes
WHERE finished_at >= date_trunc('month', CURRENT_DATE)
  AND finished_at < date_trunc('month', CURRENT_DATE) + interval '1 month'
  AND deleted_at IS NULL;

-- Orders by status this month
SELECT 
  COUNT(*) FILTER (WHERE ordered_at >= date_trunc('month', CURRENT_DATE)) AS ordered_this_month,
  COUNT(*) FILTER (WHERE in_production_at >= date_trunc('month', CURRENT_DATE)) AS started_production_this_month,
  COUNT(*) FILTER (WHERE ready_at >= date_trunc('month', CURRENT_DATE)) AS completed_this_month,
  COUNT(*) FILTER (WHERE finished_at >= date_trunc('month', CURRENT_DATE)) AS delivered_this_month
FROM quotes
WHERE deleted_at IS NULL;

-- ============================================
-- PERFORMANCE METRICS
-- ============================================

-- Fastest vs slowest orders (order to ready)
SELECT 
  quote_number,
  order_number,
  (ready_at - ordered_at) AS production_time,
  EXTRACT(EPOCH FROM (ready_at - ordered_at)) / 3600 AS hours
FROM quotes
WHERE ready_at IS NOT NULL 
  AND ordered_at IS NOT NULL
  AND deleted_at IS NULL
ORDER BY production_time ASC
LIMIT 10;

-- Orders still in production (>3 days)
SELECT 
  quote_number,
  order_number,
  in_production_at,
  NOW() - in_production_at AS time_in_production,
  EXTRACT(EPOCH FROM (NOW() - in_production_at)) / 86400 AS days_in_production
FROM quotes
WHERE status = 'in_production'
  AND in_production_at IS NOT NULL
  AND (NOW() - in_production_at) > interval '3 days'
  AND deleted_at IS NULL
ORDER BY in_production_at ASC;

-- ============================================
-- CANCELLATION ANALYTICS
-- ============================================

-- Cancelled orders by phase
SELECT 
  CASE 
    WHEN cancelled_at IS NOT NULL AND ordered_at IS NULL THEN 'Before Order'
    WHEN cancelled_at < COALESCE(in_production_at, '9999-12-31') THEN 'After Order, Before Production'
    WHEN cancelled_at < COALESCE(ready_at, '9999-12-31') THEN 'During Production'
    WHEN cancelled_at >= ready_at THEN 'After Ready'
    ELSE 'Unknown'
  END AS cancellation_phase,
  COUNT(*) AS count
FROM quotes
WHERE status = 'cancelled'
  AND cancelled_at IS NOT NULL
  AND deleted_at IS NULL
GROUP BY cancellation_phase;

-- ============================================
-- WEEKLY/DAILY REPORTS
-- ============================================

-- Orders completed per day (last 7 days)
SELECT 
  DATE(ready_at) AS completion_date,
  COUNT(*) AS orders_completed,
  SUM(final_total_after_discount) AS daily_revenue
FROM quotes
WHERE ready_at >= CURRENT_DATE - interval '7 days'
  AND deleted_at IS NULL
GROUP BY DATE(ready_at)
ORDER BY completion_date DESC;

-- Orders by hour of day (when do we complete most orders?)
SELECT 
  EXTRACT(HOUR FROM ready_at) AS hour,
  COUNT(*) AS completed_count
FROM quotes
WHERE ready_at IS NOT NULL
  AND deleted_at IS NULL
GROUP BY hour
ORDER BY hour;

-- ============================================
-- CUSTOMER ANALYTICS
-- ============================================

-- Average lead time by customer
SELECT 
  c.name AS customer_name,
  COUNT(*) AS order_count,
  AVG(q.ready_at - q.ordered_at) AS avg_lead_time,
  AVG(EXTRACT(EPOCH FROM (q.ready_at - q.ordered_at)) / 86400) AS avg_days
FROM quotes q
JOIN customers c ON q.customer_id = c.id
WHERE q.ready_at IS NOT NULL 
  AND q.ordered_at IS NOT NULL
  AND q.deleted_at IS NULL
GROUP BY c.id, c.name
HAVING COUNT(*) >= 5  -- At least 5 orders
ORDER BY avg_lead_time DESC;

-- ============================================
-- PRODUCTION EFFICIENCY
-- ============================================

-- Orders ready same day vs multi-day
SELECT 
  CASE 
    WHEN DATE(ready_at) = DATE(ordered_at) THEN 'Same Day'
    WHEN ready_at - ordered_at <= interval '1 day' THEN '1 Day'
    WHEN ready_at - ordered_at <= interval '3 days' THEN '2-3 Days'
    WHEN ready_at - ordered_at <= interval '7 days' THEN '4-7 Days'
    ELSE 'Over 1 Week'
  END AS timeframe,
  COUNT(*) AS order_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) AS percentage
FROM quotes
WHERE ready_at IS NOT NULL 
  AND ordered_at IS NOT NULL
  AND deleted_at IS NULL
GROUP BY timeframe
ORDER BY 
  CASE timeframe
    WHEN 'Same Day' THEN 1
    WHEN '1 Day' THEN 2
    WHEN '2-3 Days' THEN 3
    WHEN '4-7 Days' THEN 4
    ELSE 5
  END;

