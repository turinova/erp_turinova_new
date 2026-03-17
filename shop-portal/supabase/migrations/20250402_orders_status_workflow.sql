-- Order status workflow: extend allowed statuses for picking, picked, verifying, ready_for_pickup
-- See docs/ORDER_STATUS_WORKFLOW.md and docs/ORDER_FULFILLMENT_IMPLEMENTATION_PLAN.md

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
    'shipped',
    'ready_for_pickup',
    'delivered',
    'cancelled',
    'refunded'
  ));
