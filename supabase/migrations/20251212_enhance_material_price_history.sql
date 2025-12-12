-- Enhance material_price_history table with missing fields
-- Date: 2025-12-12
-- Purpose: Add base_price, multiplier, currency_id, vat_id, and source tracking to material price history

-- Add missing columns to material_price_history
ALTER TABLE public.material_price_history
ADD COLUMN IF NOT EXISTS old_base_price INTEGER,
ADD COLUMN IF NOT EXISTS new_base_price INTEGER,
ADD COLUMN IF NOT EXISTS old_multiplier NUMERIC(3,2),
ADD COLUMN IF NOT EXISTS new_multiplier NUMERIC(3,2),
ADD COLUMN IF NOT EXISTS old_currency_id UUID,
ADD COLUMN IF NOT EXISTS new_currency_id UUID,
ADD COLUMN IF NOT EXISTS old_vat_id UUID,
ADD COLUMN IF NOT EXISTS new_vat_id UUID,
ADD COLUMN IF NOT EXISTS source_type VARCHAR(50) DEFAULT 'edit_page',
ADD COLUMN IF NOT EXISTS source_reference TEXT;

-- Add foreign key constraints for currency and VAT
DO $$
BEGIN
  -- Add foreign key for old_currency_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'material_price_history_old_currency_id_fkey'
  ) THEN
    ALTER TABLE public.material_price_history
    ADD CONSTRAINT material_price_history_old_currency_id_fkey 
    FOREIGN KEY (old_currency_id) REFERENCES currencies(id);
  END IF;

  -- Add foreign key for new_currency_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'material_price_history_new_currency_id_fkey'
  ) THEN
    ALTER TABLE public.material_price_history
    ADD CONSTRAINT material_price_history_new_currency_id_fkey 
    FOREIGN KEY (new_currency_id) REFERENCES currencies(id);
  END IF;

  -- Add foreign key for old_vat_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'material_price_history_old_vat_id_fkey'
  ) THEN
    ALTER TABLE public.material_price_history
    ADD CONSTRAINT material_price_history_old_vat_id_fkey 
    FOREIGN KEY (old_vat_id) REFERENCES vat(id);
  END IF;

  -- Add foreign key for new_vat_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'material_price_history_new_vat_id_fkey'
  ) THEN
    ALTER TABLE public.material_price_history
    ADD CONSTRAINT material_price_history_new_vat_id_fkey 
    FOREIGN KEY (new_vat_id) REFERENCES vat(id);
  END IF;
END $$;

-- Add indexes for new foreign keys
CREATE INDEX IF NOT EXISTS idx_material_price_history_old_currency_id 
ON public.material_price_history(old_currency_id);

CREATE INDEX IF NOT EXISTS idx_material_price_history_new_currency_id 
ON public.material_price_history(new_currency_id);

CREATE INDEX IF NOT EXISTS idx_material_price_history_old_vat_id 
ON public.material_price_history(old_vat_id);

CREATE INDEX IF NOT EXISTS idx_material_price_history_new_vat_id 
ON public.material_price_history(new_vat_id);

-- Add index for source_type for filtering
CREATE INDEX IF NOT EXISTS idx_material_price_history_source_type 
ON public.material_price_history(source_type);

