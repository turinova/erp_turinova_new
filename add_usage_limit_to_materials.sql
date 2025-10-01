-- Add usage_limit (Kihasználtság küszöb) to material_settings table
-- This is a decimal value representing percentage threshold (e.g., 0.65 for 65%)

ALTER TABLE material_settings 
  ADD COLUMN IF NOT EXISTS usage_limit NUMERIC(3,2) DEFAULT 0.65 CHECK (usage_limit >= 0 AND usage_limit <= 1);

COMMENT ON COLUMN material_settings.usage_limit IS 'Kihasználtság küszöb (Usage threshold) - decimal value 0-1 representing percentage';

-- Verify the change
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'material_settings' 
  AND column_name = 'usage_limit';

