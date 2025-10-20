-- Function to update shop_order status based on shop_order_items status
-- If all items are deleted, set the order status to deleted
CREATE OR REPLACE FUNCTION update_shop_order_status()
RETURNS TRIGGER AS $$
DECLARE
  v_order_id uuid;
  v_total_items integer;
  v_deleted_items integer;
BEGIN
  -- Get the order_id from the affected row
  IF TG_OP = 'DELETE' THEN
    v_order_id := OLD.order_id;
  ELSE
    v_order_id := NEW.order_id;
  END IF;

  -- Count total items for this order (excluding soft-deleted items)
  SELECT COUNT(*)
  INTO v_total_items
  FROM shop_order_items
  WHERE order_id = v_order_id
    AND deleted_at IS NULL;

  -- Count items with status 'deleted' (excluding soft-deleted items)
  SELECT COUNT(*)
  INTO v_deleted_items
  FROM shop_order_items
  WHERE order_id = v_order_id
    AND deleted_at IS NULL
    AND status = 'deleted';

  -- If all items have status 'deleted', update the order status to 'deleted'
  IF v_total_items > 0 AND v_total_items = v_deleted_items THEN
    UPDATE shop_orders
    SET status = 'deleted',
        updated_at = NOW()
    WHERE id = v_order_id
      AND status != 'deleted'; -- Only update if not already deleted
  END IF;

  -- Return the appropriate row based on operation
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger on shop_order_items table
-- Drop the trigger if it already exists
DROP TRIGGER IF EXISTS trigger_update_shop_order_status ON shop_order_items;

-- Create the trigger
CREATE TRIGGER trigger_update_shop_order_status
  AFTER INSERT OR UPDATE OR DELETE
  ON shop_order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_shop_order_status();

-- Add comment explaining the trigger
COMMENT ON TRIGGER trigger_update_shop_order_status ON shop_order_items IS 
  'Automatically sets shop_orders.status to deleted when all related shop_order_items have status = deleted';

