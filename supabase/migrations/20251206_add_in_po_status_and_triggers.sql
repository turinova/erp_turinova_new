-- ============================================
-- Add 'in_po' status to customer_order_items
-- ============================================

-- Drop existing constraint
ALTER TABLE public.customer_order_items
  DROP CONSTRAINT IF EXISTS customer_order_items_status_check;

-- Add new constraint with 'in_po' status
ALTER TABLE public.customer_order_items
  ADD CONSTRAINT customer_order_items_status_check 
  CHECK (status IN ('open', 'in_po', 'ordered', 'arrived', 'handed_over', 'cancelled'));

-- ============================================
-- Update customer_order_items status when PO is created
-- ============================================

CREATE OR REPLACE FUNCTION update_customer_order_items_on_po_created()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- When a purchase_order_item is created with customer_order_item_id
  IF NEW.customer_order_item_id IS NOT NULL THEN
    -- Update customer_order_item status to 'in_po' if it's currently 'open'
    UPDATE public.customer_order_items
    SET status = 'in_po',
        updated_at = NOW()
    WHERE id = NEW.customer_order_item_id
      AND deleted_at IS NULL
      AND status = 'open';  -- Only update if still 'open'
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_customer_order_items_on_po_created ON public.purchase_order_items;

CREATE TRIGGER trigger_update_customer_order_items_on_po_created
  AFTER INSERT ON public.purchase_order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_order_items_on_po_created();

-- ============================================
-- Update customer_order_items status when PO status changes to 'confirmed'
-- ============================================

CREATE OR REPLACE FUNCTION update_customer_order_items_on_po_confirmed()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only trigger when status changes to 'confirmed'
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    -- Update all customer_order_items linked to purchase_order_items in this PO
    UPDATE public.customer_order_items
    SET status = 'ordered',
        updated_at = NOW()
    WHERE id IN (
      SELECT customer_order_item_id
      FROM public.purchase_order_items
      WHERE purchase_order_id = NEW.id
        AND customer_order_item_id IS NOT NULL
        AND deleted_at IS NULL
    )
    AND deleted_at IS NULL
    AND status IN ('in_po', 'open');  -- Only update if 'in_po' or 'open'
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_customer_order_items_on_po_confirmed ON public.purchase_orders;

CREATE TRIGGER trigger_update_customer_order_items_on_po_confirmed
  AFTER UPDATE OF status ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_order_items_on_po_confirmed();

COMMENT ON FUNCTION update_customer_order_items_on_po_created() IS 
  'Automatically updates customer_order_items status to ''in_po'' when purchase_order_item is created with customer_order_item_id';

COMMENT ON FUNCTION update_customer_order_items_on_po_confirmed() IS 
  'Automatically updates customer_order_items status to ''ordered'' when purchase_order status changes to ''confirmed''';

