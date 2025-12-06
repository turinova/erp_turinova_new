-- ============================================
-- Fix customer_order_items.purchase_order_item_id
-- This migration fixes existing records where purchase_order_item_id is NULL
-- but should be set based on purchase_order_items.customer_order_item_id
-- ============================================

UPDATE public.customer_order_items coi
SET purchase_order_item_id = poi.id,
    updated_at = NOW()
FROM public.purchase_order_items poi
WHERE poi.customer_order_item_id = coi.id
  AND coi.purchase_order_item_id IS NULL
  AND coi.deleted_at IS NULL
  AND poi.deleted_at IS NULL;

-- Log how many records were updated
DO $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % customer_order_items with purchase_order_item_id', v_updated_count;
END $$;

