-- Fix shop_orders status constraint to include 'arrived' status
-- Date: 2025-10-31
-- Issue: Trigger sets status='arrived' but constraint doesn't allow it

-- Drop existing constraint
ALTER TABLE shop_orders 
DROP CONSTRAINT IF EXISTS shop_orders_status_check;

-- Add updated constraint with 'arrived' status
ALTER TABLE shop_orders
ADD CONSTRAINT shop_orders_status_check 
CHECK (
  status::text = ANY (
    ARRAY[
      'open'::character varying::text,
      'ordered'::character varying::text,
      'arrived'::character varying::text,
      'finished'::character varying::text,
      'handed_over'::character varying::text,
      'deleted'::character varying::text
    ]
  )
);

COMMENT ON CONSTRAINT shop_orders_status_check ON shop_orders IS 
  'Valid statuses: open, ordered, arrived (partial delivery), finished (all arrived), handed_over (delivered to customer), deleted';

