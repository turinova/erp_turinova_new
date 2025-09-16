-- Alter materials table to add new fields
-- Run this in Supabase SQL Editor

-- 1. Add new columns to the materials table
ALTER TABLE materials 
ADD COLUMN IF NOT EXISTS on_stock BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS price DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS vat_id UUID REFERENCES vat_rates(id);

-- 2. Add comments to the new columns for documentation
COMMENT ON COLUMN materials.on_stock IS 'Indicates if the material is currently in stock (raktári)';
COMMENT ON COLUMN materials.price IS 'Price of the material in the base currency';
COMMENT ON COLUMN materials.vat_id IS 'Foreign key reference to vat_rates table for VAT calculation';

-- 3. Create an index on the vat_id foreign key for better performance
CREATE INDEX IF NOT EXISTS idx_materials_vat_id ON materials(vat_id);

-- 4. Create an index on on_stock for filtering stock status
CREATE INDEX IF NOT EXISTS idx_materials_on_stock ON materials(on_stock);

-- 5. Update existing materials with default values (optional)
-- You can modify these default values as needed
UPDATE materials 
SET 
  on_stock = true,  -- Set all existing materials as in stock by default
  price = 0.00,     -- Set default price to 0
  vat_id = (SELECT id FROM vat_rates WHERE name = 'ÁFA 27%' LIMIT 1)  -- Set default VAT to 27%
WHERE on_stock IS NULL OR price IS NULL OR vat_id IS NULL;

-- 6. Verify the changes
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'materials' 
  AND column_name IN ('on_stock', 'price', 'vat_id')
ORDER BY column_name;

-- 7. Show sample data with the new fields
SELECT 
  m.id,
  m.material_name,
  m.length_mm,
  m.width_mm,
  m.thickness_mm,
  m.grain_direction,
  m.on_stock,
  m.price,
  v.name as vat_name,
  v.kulcs as vat_rate
FROM materials m
LEFT JOIN vat_rates v ON m.vat_id = v.id
LIMIT 5;

-- 8. Create a view for easy material management with VAT information
CREATE OR REPLACE VIEW materials_with_vat AS
SELECT 
  m.id,
  m.material_name,
  m.length_mm,
  m.width_mm,
  m.thickness_mm,
  m.grain_direction,
  m.on_stock,
  m.price,
  v.id as vat_id,
  v.name as vat_name,
  v.kulcs as vat_rate,
  CASE 
    WHEN m.price > 0 AND v.kulcs > 0 THEN 
      ROUND(m.price * (1 + v.kulcs / 100), 2)
    ELSE m.price
  END as price_with_vat,
  m.created_at,
  m.updated_at
FROM materials m
LEFT JOIN vat_rates v ON m.vat_id = v.id;

-- 9. Grant permissions on the new view
GRANT SELECT ON materials_with_vat TO authenticated;
GRANT SELECT ON materials_with_vat TO anon;

-- 10. Show the new view structure
SELECT * FROM materials_with_vat LIMIT 3;
