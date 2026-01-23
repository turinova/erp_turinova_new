-- Add barcode_u column to accessories table
-- Date: 2026-01-22
-- Purpose: Add internal barcode field for generated barcodes (separate from manufacturer barcode)

-- Add barcode_u column (internal barcode for generated codes)
ALTER TABLE public.accessories 
ADD COLUMN IF NOT EXISTS barcode_u character varying(64);

-- Create index for barcode_u (similar to barcode index)
CREATE INDEX IF NOT EXISTS idx_accessories_barcode_u_active 
ON public.accessories USING btree (barcode_u) 
WHERE (deleted_at IS NULL AND barcode_u IS NOT NULL);

-- Add comment
COMMENT ON COLUMN public.accessories.barcode_u IS 'Internal barcode (generated EAN-13 codes)';
COMMENT ON COLUMN public.accessories.barcode IS 'Manufacturer barcode (Gyártói vonalkód)';
