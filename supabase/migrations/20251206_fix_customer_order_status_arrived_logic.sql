-- ============================================
-- Fix customer_order status logic: only set 'arrived' when ALL items are arrived
-- ============================================

CREATE OR REPLACE FUNCTION update_customer_order_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
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

  -- Count all active product items (excluding fees and soft-deleted)
  SELECT COUNT(*)
  INTO v_total_active
  FROM public.customer_order_items
  WHERE order_id = v_order_id
    AND deleted_at IS NULL
    AND item_type = 'product';

  -- Count items with status = 'cancelled'
  SELECT COUNT(*)
  INTO v_deleted_status_count
  FROM public.customer_order_items
  WHERE order_id = v_order_id
    AND deleted_at IS NULL
    AND item_type = 'product'
    AND status = 'cancelled';

  -- Count non-cancelled items
  SELECT COUNT(*)
  INTO v_non_deleted_count
  FROM public.customer_order_items
  WHERE order_id = v_order_id
    AND deleted_at IS NULL
    AND item_type = 'product'
    AND status != 'cancelled';

  -- Count items that are handed_over
  SELECT COUNT(*)
  INTO v_handed_over_count
  FROM public.customer_order_items
  WHERE order_id = v_order_id
    AND deleted_at IS NULL
    AND item_type = 'product'
    AND status = 'handed_over';

  -- Count items that are arrived
  SELECT COUNT(*)
  INTO v_arrived_count
  FROM public.customer_order_items
  WHERE order_id = v_order_id
    AND deleted_at IS NULL
    AND item_type = 'product'
    AND status = 'arrived';

  -- Count items that are in_po, ordered, arrived, or handed_over
  SELECT COUNT(*)
  INTO v_ordered_or_more_count
  FROM public.customer_order_items
  WHERE order_id = v_order_id
    AND deleted_at IS NULL
    AND item_type = 'product'
    AND status IN ('in_po', 'ordered', 'arrived', 'handed_over');

  -- Determine the new status based on business logic (priority order)
  IF v_total_active = 0 OR (v_total_active > 0 AND v_deleted_status_count = v_total_active) THEN
    v_new_status := 'cancelled';
  ELSIF v_non_deleted_count > 0 AND v_handed_over_count = v_non_deleted_count THEN
    v_new_status := 'handed_over';
  ELSIF v_non_deleted_count > 0 AND v_arrived_count = v_non_deleted_count THEN
    -- FIXED: Only set to 'arrived' when ALL items are arrived (changed from 'finished' to 'arrived')
    v_new_status := 'arrived';
  ELSIF v_non_deleted_count > 0 AND v_ordered_or_more_count = v_non_deleted_count THEN
    -- All items are 'in_po' or better (but not all arrived)
    v_new_status := 'ordered';
  ELSE
    -- Some items are still 'open' or not all items have progressed
    v_new_status := 'open';
  END IF;

  -- Update the customer_orders status if it changed
  UPDATE public.customer_orders
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
$$;

COMMENT ON FUNCTION update_customer_order_status() IS 
  'Automatically updates customer_orders.status based on customer_order_items statuses:
   - cancelled: All items cancelled
   - handed_over: All items handed over
   - arrived: All items arrived (FIXED: only when ALL items are arrived, not just one)
   - ordered: All items are in_po or better
   - open: Some items still open';

