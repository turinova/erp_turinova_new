-- Update materials_with_settings view to include on_stock column
-- Run this in Supabase SQL Editor

-- First, drop the existing view
DROP VIEW IF EXISTS materials_with_settings CASCADE;

-- Recreate the view with the on_stock column
CREATE VIEW materials_with_settings AS
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

-- Test the view
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
