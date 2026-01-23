-- Populate gross_price for existing accessories
-- Date: 2026-01-23
-- Purpose: Calculate and set gross_price from net_price + VAT for all existing accessories

UPDATE public.accessories
SET gross_price = net_price + ROUND(net_price * (SELECT kulcs FROM public.vat WHERE id = accessories.vat_id) / 100)
WHERE gross_price IS NULL;

-- Add comment
COMMENT ON COLUMN public.accessories.gross_price IS 'Final gross price (net_price + VAT) stored as integer in smallest currency unit (e.g., HUF forint). Aligned with Számlázz.hu invoicing standards.';
