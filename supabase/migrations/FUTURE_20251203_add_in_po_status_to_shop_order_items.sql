-- ⚠️ WARNING: This migration is for FUTURE use only!
-- DO NOT run this on production database yet!
-- This file is prefixed with FUTURE_ to prevent accidental execution
--
-- Purpose: Add 'in_po' status to shop_order_items
-- This status indicates that an item has been added to a draft purchase order
-- but the PO has not yet been confirmed by the supplier
--
-- Status flow: open → in_po (added to draft PO) → ordered (PO confirmed) → arrived → handed_over

-- Add 'in_po' status to shop_order_items
ALTER TABLE public.shop_order_items
DROP CONSTRAINT IF EXISTS shop_order_items_status_check;

ALTER TABLE public.shop_order_items
ADD CONSTRAINT shop_order_items_status_check CHECK (
  status::text = ANY (ARRAY[
    'open'::character varying,
    'in_po'::character varying,
    'ordered'::character varying,
    'arrived'::character varying,
    'handed_over'::character varying,
    'deleted'::character varying
  ]::text[])
);

COMMENT ON COLUMN public.shop_order_items.status IS 
  'Status workflow: 
   - open: Item needs to be ordered
   - in_po: Item added to draft purchase order (waiting for PO confirmation)
   - ordered: Purchase order confirmed by supplier
   - arrived: Items received at warehouse
   - handed_over: Given to customer
   - deleted: Cancelled';

-- Update the shop_order status trigger to handle 'in_po' status
-- NOTE: 'in_po' is treated as "not yet ordered" (waiting for PO confirmation)
CREATE OR REPLACE FUNCTION update_shop_order_status()
RETURNS TRIGGER AS $$
DECLARE
  v_order_id uuid;
  v_total_active integer;
  v_deleted_status_count integer;
  v_non_deleted_count integer;
  v_handed_over_count integer;
  v_arrived_count integer;
  v_ordered_or_more_count integer;
  v_new_status varchar(20);
BEGIN
  -- Get the order_id from the affected row
  IF TG_OP = 'DELETE' THEN
    v_order_id := OLD.order_id;
  ELSE
    v_order_id := NEW.order_id;
  END IF;

  -- Count all active items (excluding soft-deleted: deleted_at IS NULL)
  SELECT COUNT(*)
  INTO v_total_active
  FROM shop_order_items
  WHERE order_id = v_order_id
    AND deleted_at IS NULL;

  -- Count items with status = 'deleted'
  SELECT COUNT(*)
  INTO v_deleted_status_count
  FROM shop_order_items
  WHERE order_id = v_order_id
    AND deleted_at IS NULL
    AND status = 'deleted';

  -- Count non-deleted items (status != 'deleted')
  SELECT COUNT(*)
  INTO v_non_deleted_count
  FROM shop_order_items
  WHERE order_id = v_order_id
    AND deleted_at IS NULL
    AND status != 'deleted';

  -- Count items that are handed_over
  SELECT COUNT(*)
  INTO v_handed_over_count
  FROM shop_order_items
  WHERE order_id = v_order_id
    AND deleted_at IS NULL
    AND status = 'handed_over';

  -- Count items that have arrived
  SELECT COUNT(*)
  INTO v_arrived_count
  FROM shop_order_items
  WHERE order_id = v_order_id
    AND deleted_at IS NULL
    AND status = 'arrived';

  -- Count items that are ordered or better (ordered, arrived, handed_over)
  -- NOTE: 'in_po' is NOT included - it's still waiting for PO confirmation
  SELECT COUNT(*)
  INTO v_ordered_or_more_count
  FROM shop_order_items
  WHERE order_id = v_order_id
    AND deleted_at IS NULL
    AND status IN ('ordered', 'arrived', 'handed_over');

  -- Determine the new status based on priority
  IF v_total_active = 0 OR (v_total_active > 0 AND v_deleted_status_count = v_total_active) THEN
    -- Priority 1: All items deleted
    v_new_status := 'deleted';
  ELSIF v_non_deleted_count > 0 AND v_handed_over_count = v_non_deleted_count THEN
    -- Priority 2: All non-deleted items handed over
    v_new_status := 'handed_over';
  ELSIF v_non_deleted_count > 0 AND v_arrived_count = v_non_deleted_count THEN
    -- Priority 3: All non-deleted items arrived
    v_new_status := 'finished';
  ELSIF v_non_deleted_count > 0 AND (v_arrived_count > 0 OR v_handed_over_count > 0) THEN
    -- Priority 4: Mix of arrived/handed_over
    v_new_status := 'arrived';
  ELSIF v_non_deleted_count > 0 AND v_ordered_or_more_count = v_non_deleted_count THEN
    -- Priority 5: All non-deleted items ordered or better
    v_new_status := 'ordered';
  ELSE
    -- Priority 6: Otherwise open (includes 'in_po' items waiting for confirmation)
    v_new_status := 'open';
  END IF;

  -- Update the shop_orders status if it changed
  UPDATE shop_orders
  SET status = v_new_status,
      updated_at = NOW()
  WHERE id = v_order_id
    AND status != v_new_status;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_shop_order_status() IS 
  'Automatically updates shop_orders.status based on shop_order_items statuses.
   NOTE: in_po status is treated as "not yet ordered" (waiting for PO confirmation)
   Priority 1: deleted - All items deleted
   Priority 2: handed_over - All non-deleted items handed over
   Priority 3: finished - All non-deleted items arrived
   Priority 4: arrived - Mix of arrived/handed_over
   Priority 5: ordered - All non-deleted items ordered or better
   Priority 6: open - Some items still need ordering (includes in_po)';

