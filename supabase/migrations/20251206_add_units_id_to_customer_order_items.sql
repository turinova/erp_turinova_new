-- Add units_id to customer_order_items
ALTER TABLE public.customer_order_items
  ADD COLUMN IF NOT EXISTS units_id uuid NULL REFERENCES public.units(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_customer_order_items_units_id 
  ON public.customer_order_items(units_id);

