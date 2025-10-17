-- Add 'active' field to materials table
-- This field indicates whether a material is currently in use
-- Different from 'on_stock' (availability) and 'deleted_at' (soft delete)
-- Active = false means "don't use this material anywhere now"

-- Add the active column with default TRUE
ALTER TABLE materials 
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE NOT NULL;

-- Set all existing materials to active = true
UPDATE materials 
SET active = TRUE 
WHERE active IS NULL OR active = FALSE;

-- Add comment for documentation
COMMENT ON COLUMN materials.active IS 'Whether this material is currently active for use in optimization and operations. Inactive materials are excluded from calculations.';

-- Verify the change
SELECT 
  COUNT(*) as total_materials,
  SUM(CASE WHEN active = TRUE THEN 1 ELSE 0 END) as active_count,
  SUM(CASE WHEN active = FALSE THEN 1 ELSE 0 END) as inactive_count
FROM materials
WHERE deleted_at IS NULL;

