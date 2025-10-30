-- Backfill script to recalculate shop_orders.status based on current shop_order_items
-- Run this AFTER applying the updated trigger function
-- This ensures all existing orders have the correct status

DO $$
DECLARE
  v_order record;
  v_total_active integer;
  v_deleted_status_count integer;
  v_non_deleted_count integer;
  v_arrived_count integer;
  v_ordered_or_arrived_count integer;
  v_new_status varchar(20);
  v_updated_count integer := 0;
BEGIN
  -- Loop through all non-soft-deleted shop_orders
  FOR v_order IN 
    SELECT id, status, order_number
    FROM shop_orders
    WHERE deleted_at IS NULL
  LOOP
    -- Count all active items (excluding soft-deleted: deleted_at IS NULL)
    SELECT COUNT(*)
    INTO v_total_active
    FROM shop_order_items
    WHERE order_id = v_order.id
      AND deleted_at IS NULL;

    -- Count items with status = 'deleted'
    SELECT COUNT(*)
    INTO v_deleted_status_count
    FROM shop_order_items
    WHERE order_id = v_order.id
      AND deleted_at IS NULL
      AND status = 'deleted';

    -- Count non-deleted items (status != 'deleted')
    SELECT COUNT(*)
    INTO v_non_deleted_count
    FROM shop_order_items
    WHERE order_id = v_order.id
      AND deleted_at IS NULL
      AND status != 'deleted';

    -- Count non-deleted items that have arrived
    SELECT COUNT(*)
    INTO v_arrived_count
    FROM shop_order_items
    WHERE order_id = v_order.id
      AND deleted_at IS NULL
      AND status = 'arrived';

    -- Count non-deleted items that are ordered or arrived
    SELECT COUNT(*)
    INTO v_ordered_or_arrived_count
    FROM shop_order_items
    WHERE order_id = v_order.id
      AND deleted_at IS NULL
      AND status IN ('ordered', 'arrived');

    -- Determine the new status based on business logic
    IF v_total_active = 0 OR (v_total_active > 0 AND v_deleted_status_count = v_total_active) THEN
      v_new_status := 'deleted';
    ELSIF v_non_deleted_count > 0 AND v_arrived_count = v_non_deleted_count THEN
      v_new_status := 'finished';
    ELSIF v_non_deleted_count > 0 AND v_ordered_or_arrived_count = v_non_deleted_count THEN
      v_new_status := 'ordered';
    ELSE
      v_new_status := 'open';
    END IF;

    -- Update the shop_orders status if it changed
    IF v_order.status != v_new_status THEN
      UPDATE shop_orders
      SET status = v_new_status,
          updated_at = NOW()
      WHERE id = v_order.id;
      
      v_updated_count := v_updated_count + 1;
      
      RAISE NOTICE 'Updated order % (%) from % to %', 
        v_order.order_number, v_order.id, v_order.status, v_new_status;
    END IF;
  END LOOP;

  RAISE NOTICE 'Backfill complete: % orders updated', v_updated_count;
END $$;

