-- Add price_multiplier column to customer_groups table
-- This allows automatic price calculation based on cost or base price

ALTER TABLE public.customer_groups 
ADD COLUMN IF NOT EXISTS price_multiplier DECIMAL(10,4) DEFAULT NULL;

COMMENT ON COLUMN public.customer_groups.price_multiplier IS 
'Multiplier for auto-calculating prices (e.g., 1.1 = cost * 1.1). NULL means manual pricing.';

-- Add index for better performance when filtering by multiplier
CREATE INDEX IF NOT EXISTS idx_customer_groups_multiplier 
ON public.customer_groups(price_multiplier) 
WHERE price_multiplier IS NOT NULL AND deleted_at IS NULL;
