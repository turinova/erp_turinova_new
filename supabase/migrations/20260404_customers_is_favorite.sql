ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_customers_favorite ON public.customers (is_favorite, name)
WHERE deleted_at IS NULL AND is_favorite = true;
