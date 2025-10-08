-- Add columns to quotes table for fees and accessories totals

-- Fees totals
ALTER TABLE public.quotes 
ADD COLUMN IF NOT EXISTS fees_total_net DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS fees_total_vat DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS fees_total_gross DECIMAL(12,2) DEFAULT 0;

-- Accessories totals
ALTER TABLE public.quotes 
ADD COLUMN IF NOT EXISTS accessories_total_net DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS accessories_total_vat DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS accessories_total_gross DECIMAL(12,2) DEFAULT 0;

-- Comments
COMMENT ON COLUMN public.quotes.fees_total_net IS 'Sum of all fees net prices';
COMMENT ON COLUMN public.quotes.fees_total_vat IS 'Sum of all fees VAT amounts';
COMMENT ON COLUMN public.quotes.fees_total_gross IS 'Sum of all fees gross prices';
COMMENT ON COLUMN public.quotes.accessories_total_net IS 'Sum of all accessories total net prices';
COMMENT ON COLUMN public.quotes.accessories_total_vat IS 'Sum of all accessories total VAT amounts';
COMMENT ON COLUMN public.quotes.accessories_total_gross IS 'Sum of all accessories total gross prices';

-- Note: final_total_after_discount calculation should be:
-- (total_gross - discount) + fees_total_gross + accessories_total_gross
-- Discount only applies to materials (total_gross), not fees or accessories

