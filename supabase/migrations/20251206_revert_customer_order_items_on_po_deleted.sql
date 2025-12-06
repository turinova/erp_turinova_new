-- ============================================
-- Revert customer_order_items status when PO is deleted or cancelled
-- ============================================
-- When a purchase_order_item is deleted (hard or soft), or when the PO status
-- changes to 'cancelled', revert the linked customer_order_item status back to 'open'

CREATE OR REPLACE FUNCTION revert_customer_order_items_on_po_deleted()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_po_status varchar(20);
  v_customer_order_item_id uuid;
  v_po_id uuid;
BEGIN
  -- Get the customer_order_item_id and purchase_order_id from the deleted/updated row
  IF TG_OP = 'DELETE' THEN
    v_customer_order_item_id := OLD.customer_order_item_id;
    v_po_id := OLD.purchase_order_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    -- Soft delete: deleted_at was just set
    v_customer_order_item_id := NEW.customer_order_item_id;
    v_po_id := NEW.purchase_order_id;
  ELSE
    -- Not a delete operation, return early
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- If no customer_order_item_id, nothing to do
  IF v_customer_order_item_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Always revert when PO item is deleted, regardless of PO status
  -- If the PO item is gone, the customer_order_item should be available for a new PO
  UPDATE public.customer_order_items
  SET status = 'open',
      purchase_order_item_id = NULL,  -- Clear the FK reference
      updated_at = NOW()
  WHERE id = v_customer_order_item_id
    AND deleted_at IS NULL
    AND status IN ('in_po', 'ordered');  -- Only revert these statuses

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Also create a trigger on purchase_orders to handle status changes to 'cancelled'
CREATE OR REPLACE FUNCTION revert_customer_order_items_on_po_cancelled()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- When PO status changes to 'cancelled', revert all linked customer_order_items
  IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
    -- Revert all customer_order_items linked to this PO
    UPDATE public.customer_order_items
    SET status = 'open',
        purchase_order_item_id = NULL,  -- Clear the FK reference
        updated_at = NOW()
    WHERE id IN (
      SELECT customer_order_item_id
      FROM public.purchase_order_items
      WHERE purchase_order_id = NEW.id
        AND customer_order_item_id IS NOT NULL
        AND deleted_at IS NULL
    )
    AND deleted_at IS NULL
    AND status IN ('in_po', 'ordered');  -- Only revert these statuses
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for DELETE operations on purchase_order_items
DROP TRIGGER IF EXISTS trigger_revert_customer_order_items_on_po_deleted ON public.purchase_order_items;

CREATE TRIGGER trigger_revert_customer_order_items_on_po_deleted
  AFTER DELETE OR UPDATE OF deleted_at ON public.purchase_order_items
  FOR EACH ROW
  EXECUTE FUNCTION revert_customer_order_items_on_po_deleted();

-- Create trigger for status changes on purchase_orders
DROP TRIGGER IF EXISTS trigger_revert_customer_order_items_on_po_cancelled ON public.purchase_orders;

CREATE TRIGGER trigger_revert_customer_order_items_on_po_cancelled
  AFTER UPDATE OF status ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION revert_customer_order_items_on_po_cancelled();

COMMENT ON FUNCTION revert_customer_order_items_on_po_deleted() IS 
  'Automatically reverts customer_order_items status to ''open'' when purchase_order_item is deleted (hard or soft delete)';

COMMENT ON FUNCTION revert_customer_order_items_on_po_cancelled() IS 
  'Automatically reverts customer_order_items status to ''open'' when purchase_order status changes to ''cancelled''';

