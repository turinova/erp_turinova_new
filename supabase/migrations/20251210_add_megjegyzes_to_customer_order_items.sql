-- Add megjegyzes column to customer_order_items to store notes from shop orders
ALTER TABLE public.customer_order_items
  ADD COLUMN IF NOT EXISTS megjegyzes text NULL;

COMMENT ON COLUMN public.customer_order_items.megjegyzes IS 'Megjegyzés/notes carried over from shop order items';

