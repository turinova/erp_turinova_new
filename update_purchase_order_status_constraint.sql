-- Update purchase_orders status constraint: remove 'sent', add 'partial'
-- New statuses: draft, confirmed, partial, received, cancelled

-- Step 1: Update all existing 'sent' status to 'confirmed'
UPDATE public.purchase_orders
SET status = 'confirmed'
WHERE status = 'sent';

-- Step 2: Drop the old constraint
ALTER TABLE public.purchase_orders
  DROP CONSTRAINT IF EXISTS purchase_orders_status_check;

-- Step 3: Add the new constraint with updated statuses
ALTER TABLE public.purchase_orders
  ADD CONSTRAINT purchase_orders_status_check
    CHECK (status IN ('draft', 'confirmed', 'partial', 'received', 'cancelled'));

