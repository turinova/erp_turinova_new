-- Add per-line discount to order_items for invoicing (stored as amount; % converted on save).
-- Rounding follows Hungarian / Számlázz.hu: for HUF, amounts stored as integers where applicable.
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.order_items.discount_amount IS 'Line discount in order currency (e.g. HUF). Applied to line gross before VAT/net calculation. For invoicing (Számlázz.hu) use GROSS-based rounding when present.';
