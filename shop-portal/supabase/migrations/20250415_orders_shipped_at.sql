-- Add shipped_at to orders for packing workflow (box complete → shipped)
-- Run on TENANT database

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.orders.shipped_at IS 'When order was shipped (set on pack complete for carrier shipping)';
