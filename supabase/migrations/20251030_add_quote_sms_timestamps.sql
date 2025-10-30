-- Add SMS notification timestamp columns to quotes table
-- Date: 2025-10-30
-- Purpose: Track when SMS notifications were sent to customers

-- ============================================
-- 1. Add SMS timestamp columns
-- ============================================

ALTER TABLE public.quotes
ADD COLUMN ready_notification_sent_at timestamp with time zone NULL,
ADD COLUMN last_storage_reminder_sent_at timestamp with time zone NULL;

-- ============================================
-- 2. Add indexes for querying
-- ============================================

-- Find orders that received ready notification
CREATE INDEX IF NOT EXISTS idx_quotes_ready_notification_sent_at 
ON public.quotes(ready_notification_sent_at) 
WHERE ready_notification_sent_at IS NOT NULL;

-- Find orders that received storage reminder
CREATE INDEX IF NOT EXISTS idx_quotes_last_storage_reminder_sent_at 
ON public.quotes(last_storage_reminder_sent_at) 
WHERE last_storage_reminder_sent_at IS NOT NULL;

-- ============================================
-- 3. Add comments explaining the columns
-- ============================================

COMMENT ON COLUMN public.quotes.ready_notification_sent_at IS 
  'Timestamp when "Készre jelentés" SMS was sent to customer. NULL if SMS not sent or customer has SMS disabled. Set when order becomes ready and SMS is successfully sent.';

COMMENT ON COLUMN public.quotes.last_storage_reminder_sent_at IS 
  'Timestamp when last "Tárolás figyelmeztetés" SMS was sent to customer. NULL if no reminder sent yet. Updated each time a storage reminder is sent (tracks only the most recent reminder).';

-- ============================================
-- 4. Example queries for analytics
-- ============================================

-- Orders ready but no notification sent
-- SELECT order_number, customer_name, ready_at, ready_notification_sent_at
-- FROM quotes
-- WHERE status = 'ready' 
--   AND ready_at IS NOT NULL 
--   AND ready_notification_sent_at IS NULL;

-- Orders that needed storage reminder
-- SELECT order_number, customer_name, ready_at, last_storage_reminder_sent_at,
--        NOW() - ready_at AS time_in_storage
-- FROM quotes
-- WHERE status = 'ready' 
--   AND last_storage_reminder_sent_at IS NOT NULL;

-- Average time between ready and pickup (for orders with notification)
-- SELECT AVG(finished_at - ready_notification_sent_at) AS avg_pickup_time
-- FROM quotes
-- WHERE ready_notification_sent_at IS NOT NULL 
--   AND finished_at IS NOT NULL;

