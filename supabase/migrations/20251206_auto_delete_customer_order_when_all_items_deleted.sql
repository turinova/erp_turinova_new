-- ============================================
-- Auto-delete customer_order when all items are soft-deleted
-- ============================================

-- Function to check if all items are deleted and soft-delete the order
CREATE OR REPLACE FUNCTION auto_delete_customer_order_on_all_items_deleted()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_order_id uuid;
  v_active_items_count integer;
BEGIN
  -- Get the order_id from the trigger
  IF TG_OP = 'DELETE' THEN
    v_order_id := OLD.order_id;
  ELSE
    v_order_id := NEW.order_id;
  END IF;

  -- Count active (non-deleted) items for this order
  SELECT COUNT(*)
  INTO v_active_items_count
  FROM public.customer_order_items
  WHERE order_id = v_order_id
    AND deleted_at IS NULL
    AND item_type = 'product';

  -- If no active items remain, soft-delete the customer_order
  IF v_active_items_count = 0 THEN
    UPDATE public.customer_orders
    SET deleted_at = NOW(),
        updated_at = NOW()
    WHERE id = v_order_id
      AND deleted_at IS NULL;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Create trigger on customer_order_items
DROP TRIGGER IF EXISTS trigger_auto_delete_customer_order_on_all_items_deleted ON public.customer_order_items;

CREATE TRIGGER trigger_auto_delete_customer_order_on_all_items_deleted
  AFTER UPDATE OF deleted_at OR DELETE ON public.customer_order_items
  FOR EACH ROW
  EXECUTE FUNCTION auto_delete_customer_order_on_all_items_deleted();

