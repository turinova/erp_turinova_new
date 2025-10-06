-- Update materials_with_settings and material_effective_settings views to include usage_limit
-- Run this in Supabase SQL Editor

-- 1. Drop existing views first (CASCADE to handle dependencies)
DROP VIEW IF EXISTS materials_with_settings CASCADE;
DROP VIEW IF EXISTS material_effective_settings CASCADE;

-- 2. Recreate material_effective_settings view with usage_limit
CREATE VIEW material_effective_settings AS
SELECT 
  m.id as material_id,
  COALESCE(ms.kerf_mm, mgs.kerf_mm, 3) as kerf_mm,
  COALESCE(ms.trim_top_mm, mgs.trim_top_mm, 0) as trim_top_mm,
  COALESCE(ms.trim_right_mm, mgs.trim_right_mm, 0) as trim_right_mm,
  COALESCE(ms.trim_bottom_mm, mgs.trim_bottom_mm, 0) as trim_bottom_mm,
  COALESCE(ms.trim_left_mm, mgs.trim_left_mm, 0) as trim_left_mm,
  COALESCE(ms.rotatable, mgs.rotatable, true) as rotatable,
  COALESCE(ms.waste_multi, mgs.waste_multi, 1.0) as waste_multi,
  COALESCE(ms.usage_limit, 0.65) as usage_limit,
  m.grain_direction
FROM materials m
LEFT JOIN material_settings ms ON m.id = ms.material_id
LEFT JOIN material_groups mg ON m.group_id = mg.id
LEFT JOIN material_group_settings mgs ON mg.id = mgs.group_id
WHERE m.deleted_at IS NULL;

-- 3. Recreate materials_with_settings view with usage_limit
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
  mes.usage_limit,
  m.created_at,
  m.updated_at
FROM materials m
JOIN brands b ON m.brand_id = b.id
JOIN material_effective_settings mes ON m.id = mes.material_id
WHERE m.deleted_at IS NULL;

-- 4. Verify the views
SELECT 
  id,
  material_name,
  usage_limit,
  waste_multi,
  on_stock
FROM materials_with_settings 
LIMIT 5;

