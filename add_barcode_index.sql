-- Create index on barcode column for fast POS scanning
-- Run this in Supabase SQL Editor

CREATE INDEX IF NOT EXISTS idx_accessories_barcode_active 
ON public.accessories USING btree (barcode) 
WHERE (deleted_at IS NULL);

-- Verify the index was created
SELECT 
  indexname, 
  indexdef 
FROM pg_indexes 
WHERE tablename = 'accessories' 
  AND indexname = 'idx_accessories_barcode_active';

