-- Update machine_type column to use enum instead of varchar
-- Run this in Supabase SQL Editor

-- 1. Create the enum type for machine types
CREATE TYPE machine_type_enum AS ENUM ('Korpus');

-- 2. Add a new column with the enum type
ALTER TABLE machine_material_map 
ADD COLUMN machine_type_new machine_type_enum;

-- 3. Update the new column with existing data (assuming all existing values should be 'Korpus')
-- If you have existing data that's not 'Korpus', you'll need to handle it differently
UPDATE machine_material_map 
SET machine_type_new = 'Korpus'::machine_type_enum 
WHERE machine_type IS NOT NULL;

-- 4. Drop the old column
ALTER TABLE machine_material_map 
DROP COLUMN machine_type;

-- 5. Rename the new column to the original name
ALTER TABLE machine_material_map 
RENAME COLUMN machine_type_new TO machine_type;

-- 6. Make the column NOT NULL (since it was NOT NULL before)
ALTER TABLE machine_material_map 
ALTER COLUMN machine_type SET NOT NULL;

-- 7. Update the unique constraint to use the new enum column
-- First drop the existing constraint
ALTER TABLE machine_material_map 
DROP CONSTRAINT IF EXISTS machine_material_map_material_id_machine_type_key;

-- Then recreate it with the new enum column
ALTER TABLE machine_material_map 
ADD CONSTRAINT machine_material_map_material_id_machine_type_key 
UNIQUE (material_id, machine_type);

-- Verification query
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'machine_material_map' 
  AND column_name = 'machine_type';

-- Show the enum values
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = 'machine_type_enum'::regtype;
