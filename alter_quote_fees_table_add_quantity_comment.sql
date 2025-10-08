-- Add quantity and comment columns to quote_fees table
-- Also allow negative prices for adjustments/discounts

ALTER TABLE public.quote_fees 
ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
ADD COLUMN IF NOT EXISTS comment TEXT NULL;

-- Update the unit_price_net column to allow negative values (remove existing constraint if any)
-- Note: DECIMAL already allows negative values by default, this is just for clarity
COMMENT ON COLUMN public.quote_fees.unit_price_net IS 'Net price per unit (can be negative for discounts/adjustments)';
COMMENT ON COLUMN public.quote_fees.quantity IS 'Quantity of this fee (multiplies unit price)';
COMMENT ON COLUMN public.quote_fees.comment IS 'Optional per-quote comment for this fee';

-- Note: The existing vat_amount and gross_price will be recalculated as:
-- total_net = unit_price_net × quantity
-- total_vat = total_net × vat_rate
-- total_gross = total_net + total_vat

