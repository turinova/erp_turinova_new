-- Ensure at most one preferred supplier per product (active rows only).
-- This enforces what application logic already expects.

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_suppliers_one_preferred_per_product
ON public.product_suppliers(product_id)
WHERE deleted_at IS NULL AND is_preferred = true;
