-- Add on_stock field to materials table and update view
-- Run this in Supabase SQL Editor

-- 1. Add the on_stock column to the materials table
ALTER TABLE materials 
ADD COLUMN on_stock BOOLEAN DEFAULT true;

-- 2. Add a comment to describe the field
COMMENT ON COLUMN materials.on_stock IS 'Indicates whether the material is currently in stock (true) or not (false)';

-- 3. Update existing materials to have on_stock = true by default
UPDATE materials 
SET on_stock = true 
WHERE on_stock IS NULL;

-- 4. Make the column NOT NULL after setting default values
ALTER TABLE materials 
ALTER COLUMN on_stock SET NOT NULL;

-- 5. Update the materials_with_settings view to include on_stock
CREATE OR REPLACE VIEW materials_with_settings AS
SELECT 
  m.id,
  b.name as brand_name,
  m.name as material_name,
  m.length_mm,
  m.width_mm,
  m.thickness_mm,
  m.grain_direction,
  m.on_stock,
  m.image_url,
  mes.kerf_mm,
  mes.trim_top_mm,
  mes.trim_right_mm,
  mes.trim_bottom_mm,
  mes.trim_left_mm,
  mes.rotatable,
  mes.waste_multi,
  m.created_at,
  m.updated_at
FROM materials m
JOIN brands b ON m.brand_id = b.id
JOIN material_effective_settings mes ON m.id = mes.material_id
WHERE m.deleted_at IS NULL;

-- 6. Verify the changes
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'materials' 
  AND column_name = 'on_stock';

-- 7. Test the view
SELECT 
  id,
  material_name,
  length_mm,
  width_mm,
  thickness_mm,
  grain_direction,
  on_stock,
  created_at
FROM materials_with_settings 
LIMIT 5;
