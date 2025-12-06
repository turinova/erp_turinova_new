-- Add sms_sent_at column to customer_orders table
-- Date: 2025-12-06
-- Purpose: Track when SMS notification was sent to customer for arrived orders

-- Add the column
ALTER TABLE public.customer_orders
ADD COLUMN IF NOT EXISTS sms_sent_at timestamp with time zone NULL;

-- Add index for querying orders by SMS sent status
CREATE INDEX IF NOT EXISTS idx_customer_orders_sms_sent_at 
ON public.customer_orders(sms_sent_at) 
WHERE sms_sent_at IS NOT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN public.customer_orders.sms_sent_at IS 
  'Timestamp when SMS notification was sent to customer for arrived order. NULL if SMS not sent yet.';

