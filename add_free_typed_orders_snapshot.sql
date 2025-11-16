-- Allow snapshot lines for free-typed items on quotes
ALTER TABLE public.quote_accessories
  ALTER COLUMN accessory_id DROP NOT NULL;

ALTER TABLE public.quote_accessories
  ADD COLUMN IF NOT EXISTS product_suggestion_id uuid NULL
    REFERENCES public.product_suggestions (id) ON DELETE SET NULL;

-- Ensure either a real accessory or a complete snapshot is present
ALTER TABLE public.quote_accessories
  ADD CONSTRAINT IF NOT EXISTS chk_quote_accessories_real_or_snapshot
  CHECK (
    accessory_id IS NOT NULL
    OR (
      accessory_name IS NOT NULL
      AND sku IS NOT NULL
      AND base_price IS NOT NULL
      AND multiplier IS NOT NULL
      AND unit_id IS NOT NULL
      AND unit_name IS NOT NULL
      AND currency_id IS NOT NULL
      AND vat_rate IS NOT NULL
      AND unit_price_net IS NOT NULL
      AND total_net IS NOT NULL
      AND total_vat IS NOT NULL
      AND total_gross IS NOT NULL
    )
  );

-- Let product suggestions be created from orders without shop_order_item link and track quote
ALTER TABLE public.product_suggestions
  ALTER COLUMN shop_order_item_id DROP NOT NULL;

ALTER TABLE public.product_suggestions
  ADD COLUMN IF NOT EXISTS quote_id uuid NULL REFERENCES public.quotes (id);

-- Make sure source_type can include 'order'
-- If you have a CHECK constraint on source_type, ensure it includes 'order'
-- Example (uncomment and adapt if needed):
-- ALTER TABLE public.product_suggestions
--   DROP CONSTRAINT IF EXISTS product_suggestions_source_type_check;
-- ALTER TABLE public.product_suggestions
--   ADD CONSTRAINT product_suggestions_source_type_check
--   CHECK (source_type IN ('shop_order','order'));

