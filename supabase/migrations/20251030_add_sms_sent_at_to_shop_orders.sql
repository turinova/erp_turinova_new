-- Add sms_sent_at column to shop_orders table
-- Date: 2025-10-30
-- Purpose: Track when Beszerzés SMS notification was sent to customer

-- Add the column
ALTER TABLE public.shop_orders
ADD COLUMN sms_sent_at timestamp with time zone NULL;

-- Add index for querying orders by SMS sent status
CREATE INDEX IF NOT EXISTS idx_shop_orders_sms_sent_at 
ON public.shop_orders(sms_sent_at) 
WHERE sms_sent_at IS NOT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN public.shop_orders.sms_sent_at IS 
  'Timestamp when Beszerzés SMS notification was sent to customer. NULL if SMS not sent yet or customer has SMS disabled.';

