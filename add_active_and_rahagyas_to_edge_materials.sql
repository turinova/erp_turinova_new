-- Add 'active' and 'ráhagyás' fields to edge_materials table
-- Active: Controls whether edge material is available for use
-- Ráhagyás: Edge overhang in millimeters (used in optimization calculations)

-- Add the active column with default TRUE
ALTER TABLE edge_materials 
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE NOT NULL;

-- Add the ráhagyás column with default 0
ALTER TABLE edge_materials 
ADD COLUMN IF NOT EXISTS ráhagyás INTEGER DEFAULT 0 NOT NULL;

-- Set all existing edge materials to active = true and ráhagyás = 0
UPDATE edge_materials 
SET active = TRUE, ráhagyás = 0
WHERE active IS NULL OR ráhagyás IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN edge_materials.active IS 'Whether this edge material is currently active for use. Inactive edge materials are excluded from optimization.';
COMMENT ON COLUMN edge_materials.ráhagyás IS 'Edge overhang in millimeters. Used in optimization calculations. Default is 0mm.';

-- Add index for active field (for filtering)
CREATE INDEX IF NOT EXISTS idx_edge_materials_active_only ON edge_materials(active) 
WHERE deleted_at IS NULL;

-- Verify the changes
SELECT 
  COUNT(*) as total_edge_materials,
  SUM(CASE WHEN active = TRUE THEN 1 ELSE 0 END) as active_count,
  SUM(CASE WHEN active = FALSE THEN 1 ELSE 0 END) as inactive_count,
  AVG(ráhagyás) as avg_rahagyas
FROM edge_materials
WHERE deleted_at IS NULL;

