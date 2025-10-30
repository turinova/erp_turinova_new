-- Add 'handed_over' status to shop_order_items and shop_orders
-- Date: 2025-10-30

-- ============================================
-- 1. Update shop_order_items status constraint
-- ============================================

-- Drop existing constraint
ALTER TABLE shop_order_items 
DROP CONSTRAINT IF EXISTS shop_order_items_status_check;

-- Add new constraint with 'handed_over' status
ALTER TABLE shop_order_items
ADD CONSTRAINT shop_order_items_status_check 
CHECK (
  status::text = ANY (
    ARRAY[
      'open'::character varying::text,
      'ordered'::character varying::text,
      'arrived'::character varying::text,
      'handed_over'::character varying::text,
      'deleted'::character varying::text
    ]
  )
);

-- ============================================
-- 2. Update shop_orders status constraint
-- ============================================

-- Drop existing constraint
ALTER TABLE shop_orders 
DROP CONSTRAINT IF EXISTS shop_orders_status_check;

-- Add new constraint with 'handed_over' status
ALTER TABLE shop_orders
ADD CONSTRAINT shop_orders_status_check 
CHECK (
  status::text = ANY (
    ARRAY[
      'open'::character varying::text,
      'ordered'::character varying::text,
      'finished'::character varying::text,
      'handed_over'::character varying::text,
      'deleted'::character varying::text
    ]
  )
);

-- ============================================
-- 3. Update shop_order status trigger function
-- ============================================

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

  -- Count items that are arrived
  SELECT COUNT(*)
  INTO v_arrived_count
  FROM shop_order_items
  WHERE order_id = v_order_id
    AND deleted_at IS NULL
    AND status = 'arrived';

  -- Count items that are ordered, arrived, or handed_over
  SELECT COUNT(*)
  INTO v_ordered_or_more_count
  FROM shop_order_items
  WHERE order_id = v_order_id
    AND deleted_at IS NULL
    AND status IN ('ordered', 'arrived', 'handed_over');

  -- Determine the new status based on business logic (priority order)
  IF v_total_active = 0 OR (v_total_active > 0 AND v_deleted_status_count = v_total_active) THEN
    -- Priority 1: All items are deleted → order is deleted
    v_new_status := 'deleted';
  ELSIF v_non_deleted_count > 0 AND v_handed_over_count = v_non_deleted_count THEN
    -- Priority 2: All non-deleted items are handed_over → order is handed_over (final state)
    v_new_status := 'handed_over';
  ELSIF v_non_deleted_count > 0 AND v_arrived_count = v_non_deleted_count THEN
    -- Priority 3: All non-deleted items are arrived → order is finished (ready for handover)
    v_new_status := 'finished';
  ELSIF v_non_deleted_count > 0 AND (v_arrived_count > 0 OR v_handed_over_count > 0) THEN
    -- Priority 4: Mix of arrived/handed_over (partial handover) → order stays at arrived
    v_new_status := 'arrived';
  ELSIF v_non_deleted_count > 0 AND v_ordered_or_more_count = v_non_deleted_count THEN
    -- Priority 5: All non-deleted items are ordered or better → order is ordered
    v_new_status := 'ordered';
  ELSE
    -- Priority 6: Otherwise → order is open (some items still need to be ordered)
    v_new_status := 'open';
  END IF;

  -- Update the shop_orders status if it changed
  UPDATE shop_orders
  SET status = v_new_status,
      updated_at = NOW()
  WHERE id = v_order_id
    AND status != v_new_status; -- Only update if status actually changed

  -- Return the appropriate row based on operation
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Comment explaining the trigger logic
COMMENT ON FUNCTION update_shop_order_status() IS 
  'Automatically updates shop_orders.status based on shop_order_items statuses:
   Priority 1: deleted - All items have status=deleted
   Priority 2: handed_over - All non-deleted items handed over to customer (final state)
   Priority 3: finished - All non-deleted items have arrived (ready for handover)
   Priority 4: arrived - Mix of arrived/handed_over (partial handover in progress)
   Priority 5: ordered - All non-deleted items are ordered or better
   Priority 6: open - Some non-deleted items still need ordering';


