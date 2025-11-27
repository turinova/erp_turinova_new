-- Add email tracking columns to purchase_orders table
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS email_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_sent_at timestamp with time zone NULL;

-- Add index for email_sent
CREATE INDEX IF NOT EXISTS idx_purchase_orders_email_sent 
  ON public.purchase_orders(email_sent) 
  WHERE deleted_at IS NULL;

