-- Material Pricing System Migration
-- Adds pricing columns to materials table and creates price history tracking

-- =====================================================================
-- STEP 1: Add pricing columns to materials table
-- =====================================================================

ALTER TABLE materials 
  ADD COLUMN IF NOT EXISTS price_per_sqm NUMERIC(10,2) NOT NULL DEFAULT 0;

ALTER TABLE materials 
  ADD COLUMN IF NOT EXISTS currency_id UUID REFERENCES currencies(id);

ALTER TABLE materials 
  ADD COLUMN IF NOT EXISTS vat_id UUID REFERENCES vat(id);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_materials_currency_id ON materials(currency_id);
CREATE INDEX IF NOT EXISTS idx_materials_vat_id ON materials(vat_id);

-- =====================================================================
-- STEP 2: Create material_price_history table
-- =====================================================================

CREATE TABLE IF NOT EXISTS material_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  old_price_per_sqm NUMERIC(10,2) NOT NULL,
  new_price_per_sqm NUMERIC(10,2) NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_material_price_history_material_id 
  ON material_price_history(material_id);

CREATE INDEX IF NOT EXISTS idx_material_price_history_changed_at 
  ON material_price_history(changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_material_price_history_changed_by 
  ON material_price_history(changed_by);

-- =====================================================================
-- STEP 3: Set default currency and VAT for all existing materials
-- =====================================================================

-- Get default HUF currency ID and 27% VAT ID
DO $$
DECLARE
  default_currency_id UUID;
  default_vat_id UUID;
BEGIN
  -- Find HUF currency
  SELECT id INTO default_currency_id 
  FROM currencies 
  WHERE name = 'HUF' 
  LIMIT 1;
  
  -- Find 27% VAT
  SELECT id INTO default_vat_id 
  FROM vat 
  WHERE kulcs = 27 OR name LIKE '%27%'
  LIMIT 1;
  
  -- Update all materials without currency_id
  IF default_currency_id IS NOT NULL THEN
    UPDATE materials 
    SET currency_id = default_currency_id
    WHERE currency_id IS NULL;
    
    RAISE NOTICE 'Set default currency (HUF) for existing materials';
  ELSE
    RAISE WARNING 'HUF currency not found - please create it first';
  END IF;
  
  -- Update all materials without vat_id
  IF default_vat_id IS NOT NULL THEN
    UPDATE materials 
    SET vat_id = default_vat_id
    WHERE vat_id IS NULL;
    
    RAISE NOTICE 'Set default VAT (27%%) for existing materials';
  ELSE
    RAISE WARNING '27%% VAT not found - please create it first';
  END IF;
END $$;

-- =====================================================================
-- STEP 4: Set initial price for "103 FS3" material
-- =====================================================================

UPDATE materials
SET price_per_sqm = 5000
WHERE name LIKE '%103 FS3%' OR name LIKE '%103%FS3%';

-- =====================================================================
-- STEP 5: Add comments for documentation
-- =====================================================================

COMMENT ON COLUMN materials.price_per_sqm IS 'Price per square meter in the specified currency';
COMMENT ON COLUMN materials.currency_id IS 'Foreign key to currencies table';
COMMENT ON COLUMN materials.vat_id IS 'Foreign key to vat table';

COMMENT ON TABLE material_price_history IS 'Tracks all price changes for materials over time';
COMMENT ON COLUMN material_price_history.material_id IS 'Reference to the material whose price changed';
COMMENT ON COLUMN material_price_history.old_price_per_sqm IS 'Price before the change';
COMMENT ON COLUMN material_price_history.new_price_per_sqm IS 'Price after the change';
COMMENT ON COLUMN material_price_history.changed_by IS 'User who made the price change';
COMMENT ON COLUMN material_price_history.changed_at IS 'Timestamp when the price was changed';

