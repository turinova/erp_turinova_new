-- ⚠️ WARNING: This migration is for FUTURE use only!
-- DO NOT run this on production database yet!
-- This file is prefixed with FUTURE_ to prevent accidental execution
--
-- Purpose: Auto-update shop_order_items status when purchase order is confirmed
-- When a purchase_order status changes to 'confirmed', all linked shop_order_items
-- that are in 'in_po' status will automatically change to 'ordered' status
--
-- This migration depends on: FUTURE_20251203_add_in_po_status_to_shop_order_items.sql

-- Function to update shop_order_items status when PO is confirmed
CREATE OR REPLACE FUNCTION update_shop_order_items_on_po_confirm()
RETURNS TRIGGER AS $$
DECLARE
  v_updated_count integer;
BEGIN
  -- Only trigger when status changes TO 'confirmed'
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    
    -- Update all shop_order_items linked to this PO from 'in_po' to 'ordered'
    WITH updated_items AS (
      UPDATE shop_order_items
      SET status = 'ordered',
          updated_at = NOW()
      WHERE id IN (
        SELECT shop_order_item_id
        FROM purchase_order_items
        WHERE purchase_order_id = NEW.id
          AND shop_order_item_id IS NOT NULL
      )
      AND status = 'in_po' -- Only update items that are in 'in_po' status
      AND deleted_at IS NULL
      RETURNING id
    )
    SELECT COUNT(*) INTO v_updated_count FROM updated_items;
    
    -- Log the update
    RAISE NOTICE 'PO % confirmed: Updated % shop_order_items from in_po to ordered', 
      NEW.po_number, 
      v_updated_count;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on purchase_orders
DROP TRIGGER IF EXISTS trigger_update_shop_items_on_po_confirm ON purchase_orders;

CREATE TRIGGER trigger_update_shop_items_on_po_confirm
  AFTER UPDATE ON purchase_orders
  FOR EACH ROW
  WHEN (NEW.status = 'confirmed' AND OLD.status != 'confirmed')
  EXECUTE FUNCTION update_shop_order_items_on_po_confirm();

COMMENT ON FUNCTION update_shop_order_items_on_po_confirm() IS 
  'Automatically updates linked shop_order_items from in_po to ordered status
   when a purchase_order is confirmed by the supplier.
   
   This ensures that customer order items reflect the actual PO confirmation,
   maintaining data consistency throughout the order lifecycle.
   
   Workflow: 
   1. User creates PO from shop_order_items → items status = in_po (draft PO)
   2. Supplier confirms PO → this trigger fires → items status = ordered
   3. Items arrive → user manually updates to arrived
   4. Items handed to customer → user manually updates to handed_over';

COMMENT ON TRIGGER trigger_update_shop_items_on_po_confirm ON purchase_orders IS 
  'Auto-updates shop_order_items status when purchase_order is confirmed';

