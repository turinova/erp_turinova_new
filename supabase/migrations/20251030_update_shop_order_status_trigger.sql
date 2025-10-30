-- Update shop_order status trigger to handle deleted items properly
-- Business Logic:
-- 1. If ALL items are status='deleted' → shop_orders.status = 'deleted'
-- 2. If ALL non-deleted items are status='arrived' → shop_orders.status = 'finished'
-- 3. If ALL non-deleted items are 'ordered' or 'arrived' → shop_orders.status = 'ordered'
-- 4. Otherwise → shop_orders.status = 'open'

CREATE OR REPLACE FUNCTION update_shop_order_status()
RETURNS TRIGGER AS $$
DECLARE
  v_order_id uuid;
  v_total_active integer;
  v_deleted_status_count integer;
  v_non_deleted_count integer;
  v_arrived_count integer;
  v_ordered_or_arrived_count integer;
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

  -- Count non-deleted items that have arrived
  SELECT COUNT(*)
  INTO v_arrived_count
  FROM shop_order_items
  WHERE order_id = v_order_id
    AND deleted_at IS NULL
    AND status = 'arrived';

  -- Count non-deleted items that are ordered or arrived
  SELECT COUNT(*)
  INTO v_ordered_or_arrived_count
  FROM shop_order_items
  WHERE order_id = v_order_id
    AND deleted_at IS NULL
    AND status IN ('ordered', 'arrived');

  -- Determine the new status based on business logic
  IF v_total_active = 0 OR (v_total_active > 0 AND v_deleted_status_count = v_total_active) THEN
    -- Rule 1: All items are deleted → order is deleted
    v_new_status := 'deleted';
  ELSIF v_non_deleted_count > 0 AND v_arrived_count = v_non_deleted_count THEN
    -- Rule 2: All non-deleted items have arrived → order is finished
    v_new_status := 'finished';
  ELSIF v_non_deleted_count > 0 AND v_ordered_or_arrived_count = v_non_deleted_count THEN
    -- Rule 3: All non-deleted items are ordered or arrived → order is ordered
    v_new_status := 'ordered';
  ELSE
    -- Rule 4: Otherwise → order is open (some items still need to be ordered)
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

-- Drop and recreate the trigger to ensure it uses the updated function
DROP TRIGGER IF EXISTS trigger_update_shop_order_status ON shop_order_items;

CREATE TRIGGER trigger_update_shop_order_status
  AFTER INSERT OR UPDATE OR DELETE
  ON shop_order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_shop_order_status();

-- Add detailed comment explaining the trigger logic
COMMENT ON FUNCTION update_shop_order_status() IS 
  'Automatically updates shop_orders.status based on shop_order_items statuses:
   - deleted: All items have status=deleted
   - finished: All non-deleted items have status=arrived (deleted items are ignored)
   - ordered: All non-deleted items have status in (ordered, arrived)
   - open: Some non-deleted items still have status=open';

COMMENT ON TRIGGER trigger_update_shop_order_status ON shop_order_items IS 
  'Updates parent shop_order status whenever items are inserted, updated, or deleted. Deleted items are ignored when determining if order is finished.';

