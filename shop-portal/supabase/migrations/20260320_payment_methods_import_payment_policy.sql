-- Per ERP payment method: how to set payment when importing an order from the webshop buffer.
-- Run on each TENANT database (user may run manually).

ALTER TABLE public.payment_methods
ADD COLUMN IF NOT EXISTS import_payment_policy TEXT NOT NULL DEFAULT 'pending';

ALTER TABLE public.payment_methods
DROP CONSTRAINT IF EXISTS payment_methods_import_payment_policy_check;

ALTER TABLE public.payment_methods
ADD CONSTRAINT payment_methods_import_payment_policy_check
CHECK (import_payment_policy IN ('pending', 'paid_on_import'));

COMMENT ON COLUMN public.payment_methods.import_payment_policy IS
  'Buffer import: pending = leave unpaid; paid_on_import = insert order_payments row so trigger sets orders.payment_status to paid.';

-- At most one synthetic import payment per order (idempotent buffer re-runs)
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_payments_import_auto_paid_unique
ON public.order_payments (order_id)
WHERE reference_number = 'import_auto_paid' AND deleted_at IS NULL;
