-- Enhance linear_material_price_history table with missing fields
-- Date: 2025-12-12
-- Purpose: Add base_price, multiplier, and source tracking to linear material price history

-- Add missing columns to linear_material_price_history
ALTER TABLE public.linear_material_price_history
ADD COLUMN IF NOT EXISTS old_base_price INTEGER,
ADD COLUMN IF NOT EXISTS new_base_price INTEGER,
ADD COLUMN IF NOT EXISTS old_multiplier NUMERIC(3,2),
ADD COLUMN IF NOT EXISTS new_multiplier NUMERIC(3,2),
ADD COLUMN IF NOT EXISTS source_type VARCHAR(50) DEFAULT 'edit_page',
ADD COLUMN IF NOT EXISTS source_reference TEXT;

-- Add index for source_type for filtering
CREATE INDEX IF NOT EXISTS idx_linear_material_price_history_source_type 
ON public.linear_material_price_history(source_type);

