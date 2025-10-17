-- =====================================================================
-- MATERIAL PRICING SYSTEM - DIRECT SQL SCRIPT
-- Run this directly in Supabase SQL Editor
-- =====================================================================

-- STEP 1: Add pricing columns to materials table
-- =====================================================================

ALTER TABLE materials 
  ADD COLUMN IF NOT EXISTS price_per_sqm NUMERIC(10,2) NOT NULL DEFAULT 0;

ALTER TABLE materials 
  ADD COLUMN IF NOT EXISTS currency_id UUID REFERENCES currencies(id);

ALTER TABLE materials 
  ADD COLUMN IF NOT EXISTS vat_id UUID REFERENCES vat(id);

CREATE INDEX IF NOT EXISTS idx_materials_currency_id ON materials(currency_id);
CREATE INDEX IF NOT EXISTS idx_materials_vat_id ON materials(vat_id);


-- STEP 2: Create price history table
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

CREATE INDEX IF NOT EXISTS idx_material_price_history_material_id 
  ON material_price_history(material_id);

CREATE INDEX IF NOT EXISTS idx_material_price_history_changed_at 
  ON material_price_history(changed_at DESC);


-- STEP 3: Set default HUF currency for all materials
-- =====================================================================

UPDATE materials 
SET currency_id = (SELECT id FROM currencies WHERE name = 'HUF' LIMIT 1)
WHERE currency_id IS NULL;


-- STEP 4: Set default 27% VAT for all materials
-- =====================================================================

UPDATE materials 
SET vat_id = (SELECT id FROM vat WHERE kulcs = 27 LIMIT 1)
WHERE vat_id IS NULL;


-- STEP 5: Set initial price for "103 FS3" material (5000 Ft/m²)
-- =====================================================================

UPDATE materials
SET price_per_sqm = 5000
WHERE name LIKE '%103 FS3%' OR name LIKE '%103%FS3%';


-- STEP 6: Verify the changes
-- =====================================================================

-- Check if columns were added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'materials' 
  AND column_name IN ('price_per_sqm', 'currency_id', 'vat_id')
ORDER BY column_name;

-- Check if price history table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'material_price_history';

-- View materials with pricing
SELECT 
  id,
  name,
  price_per_sqm,
  (SELECT name FROM currencies WHERE id = materials.currency_id) as currency,
  (SELECT name FROM vat WHERE id = materials.vat_id) as vat_name,
  length_mm,
  width_mm,
  ROUND((length_mm * width_mm / 1000000.0)::numeric, 3) as sqm,
  ROUND((length_mm * width_mm / 1000000.0 * price_per_sqm)::numeric, 2) as full_board_cost
FROM materials
WHERE deleted_at IS NULL
ORDER BY name
LIMIT 5;

