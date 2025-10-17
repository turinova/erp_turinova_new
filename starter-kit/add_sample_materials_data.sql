-- Add sample materials data to Supabase
-- This script adds sample brands, material groups, and materials

-- 1. Add sample brands
INSERT INTO brands (id, name, created_at) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'Egger', now()),
  ('550e8400-e29b-41d4-a716-446655440002', 'Kronospan', now()),
  ('550e8400-e29b-41d4-a716-446655440003', 'Swiss Krono', now()),
  ('550e8400-e29b-41d4-a716-446655440004', 'Pfleiderer', now()),
  ('550e8400-e29b-41d4-a716-446655440005', 'Sonae', now())
ON CONFLICT (name) DO NOTHING;

-- 2. Add sample material groups
INSERT INTO material_groups (id, name, description, created_at) VALUES
  ('660e8400-e29b-41d4-a716-446655440001', 'MDF', 'Medium Density Fiberboard - versatile material for furniture and construction', now()),
  ('660e8400-e29b-41d4-a716-446655440002', 'Particle Board', 'Chipboard made from wood particles and resin', now()),
  ('660e8400-e29b-41d4-a716-446655440003', 'OSB', 'Oriented Strand Board - structural panel', now()),
  ('660e8400-e29b-41d4-a716-446655440004', 'Plywood', 'Multi-layer wood panel', now()),
  ('660e8400-e29b-41d4-a716-446655440005', 'Melamine', 'Decorative surface material', now())
ON CONFLICT (name) DO NOTHING;

-- 3. Add sample materials
INSERT INTO materials (id, brand_id, group_id, name, length_mm, width_mm, thickness_mm, grain_direction, image_url, created_at, updated_at) VALUES
  -- Egger MDF materials
  ('770e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440001', 'Egger MDF 18mm White', 2800, 2070, 18, false, null, now(), now()),
  ('770e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440001', 'Egger MDF 18mm Oak', 2800, 2070, 18, false, null, now(), now()),
  ('770e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440001', 'Egger MDF 25mm White', 2800, 2070, 25, false, null, now(), now()),
  
  -- Kronospan materials
  ('770e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440002', 'Kronospan Particle Board 18mm', 2800, 2070, 18, false, null, now(), now()),
  ('770e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440002', 'Kronospan Particle Board 25mm', 2800, 2070, 25, false, null, now(), now()),
  
  -- Swiss Krono OSB
  ('770e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440003', 'Swiss Krono OSB 18mm', 2800, 1250, 18, true, null, now(), now()),
  ('770e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440003', 'Swiss Krono OSB 22mm', 2800, 1250, 22, true, null, now(), now()),
  
  -- Pfleiderer Plywood
  ('770e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440004', '660e8400-e29b-41d4-a716-446655440004', 'Pfleiderer Plywood 18mm', 2500, 1250, 18, true, null, now(), now()),
  
  -- Sonae Melamine
  ('770e8400-e29b-41d4-a716-446655440009', '550e8400-e29b-41d4-a716-446655440005', '660e8400-e29b-41d4-a716-446655440005', 'Sonae Melamine 16mm White', 2800, 2070, 16, false, null, now(), now()),
  ('770e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440005', '660e8400-e29b-41d4-a716-446655440005', 'Sonae Melamine 18mm Oak', 2800, 2070, 18, false, null, now(), now())
ON CONFLICT (brand_id, name, length_mm, width_mm, thickness_mm) DO NOTHING;

-- 4. Add sample material group settings
INSERT INTO material_group_settings (id, group_id, kerf_mm, trim_top_mm, trim_right_mm, trim_bottom_mm, trim_left_mm, rotatable, waste_multi, created_at, updated_at) VALUES
  ('880e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440001', 3, 10, 0, 0, 10, true, 1.0, now(), now()),  -- MDF settings
  ('880e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440002', 3, 10, 0, 0, 10, true, 1.0, now(), now()),  -- Particle Board settings
  ('880e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440003', 3, 10, 0, 0, 10, true, 1.0, now(), now()),  -- OSB settings
  ('880e8400-e29b-41d4-a716-446655440004', '660e8400-e29b-41d4-a716-446655440004', 3, 10, 0, 0, 10, true, 1.0, now(), now()),  -- Plywood settings
  ('880e8400-e29b-41d4-a716-446655440005', '660e8400-e29b-41d4-a716-446655440005', 3, 10, 0, 0, 10, true, 1.0, now(), now())   -- Melamine settings
ON CONFLICT (group_id) DO NOTHING;

-- 5. Add sample material settings (overrides for specific materials)
INSERT INTO material_settings (id, material_id, kerf_mm, trim_top_mm, trim_right_mm, trim_bottom_mm, trim_left_mm, rotatable, waste_multi, created_at, updated_at) VALUES
  ('990e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440001', 3, 10, 0, 0, 10, true, 1.0, now(), now()),  -- Egger MDF 18mm White
  ('990e8400-e29b-41d4-a716-446655440002', '770e8400-e29b-41d4-a716-446655440006', 3, 10, 0, 0, 10, false, 1.0, now(), now())   -- Swiss Krono OSB 18mm (not rotatable)
ON CONFLICT (material_id) DO NOTHING;

-- 6. Add sample machine material mappings
INSERT INTO machine_material_map (id, material_id, machine_type, machine_code, created_at) VALUES
  ('aa0e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440001', 'GABBIANI_SIGMA', 'EGG-MDF-18-WHT', now()),
  ('aa0e8400-e29b-41d4-a716-446655440002', '770e8400-e29b-41d4-a716-446655440001', 'HOMAG', 'EGG001', now()),
  ('aa0e8400-e29b-41d4-a716-446655440003', '770e8400-e29b-41d4-a716-446655440002', 'GABBIANI_SIGMA', 'EGG-MDF-18-OAK', now()),
  ('aa0e8400-e29b-41d4-a716-446655440004', '770e8400-e29b-41d4-a716-446655440004', 'SCM', 'KRN001', now()),
  ('aa0e8400-e29b-41d4-a716-446655440005', '770e8400-e29b-41d4-a716-446655440006', 'GABBIANI_SIGMA', 'SWK-OSB-18', now())
ON CONFLICT (material_id, machine_type) DO NOTHING;
