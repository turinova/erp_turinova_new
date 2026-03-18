-- Add awaiting_carrier status: "Futárra vár" (after pack complete for carrier, before handed to carrier)
-- See docs/ORDER_STATUS_WORKFLOW.md

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check CHECK (status IN (
    'pending_review',
    'new',
    'picking',
    'picked',
    'verifying',
    'packing',
    'awaiting_carrier',
    'shipped',
    'ready_for_pickup',
    'delivered',
    'cancelled',
    'refunded'
  ));

COMMENT ON COLUMN public.orders.status IS 'awaiting_carrier = Futárra vár (label printed, not yet handed to carrier)';
