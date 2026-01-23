-- Add gross_price column to accessories table
-- Date: 2026-01-23
-- Purpose: Store final gross prices to eliminate precision loss and align with Számlázz.hu

ALTER TABLE public.accessories
ADD COLUMN gross_price INTEGER NULL;

-- Add comment
COMMENT ON COLUMN public.accessories.gross_price IS 'Final gross price (net_price + VAT) stored as integer in smallest currency unit (e.g., HUF forint). Aligned with Számlázz.hu invoicing standards.';
