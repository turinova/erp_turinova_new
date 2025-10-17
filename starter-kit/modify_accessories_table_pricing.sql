-- Modify accessories table to support base_price and multiplier pricing
-- Run this SQL manually in your database

-- Step 1: Add new columns
ALTER TABLE public.accessories 
ADD COLUMN base_price INTEGER,
ADD COLUMN multiplier DECIMAL(3,2) DEFAULT 1.38;

-- Step 2: Migrate existing data
-- Calculate base_price from existing net_price using default multiplier 1.38
UPDATE public.accessories 
SET 
  base_price = ROUND(net_price / 1.38),
  multiplier = 1.38
WHERE base_price IS NULL;

-- Step 3: Make base_price NOT NULL after migration
ALTER TABLE public.accessories 
ALTER COLUMN base_price SET NOT NULL;

-- Step 4: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_accessories_base_price ON public.accessories USING btree (base_price) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_accessories_multiplier ON public.accessories USING btree (multiplier) TABLESPACE pg_default;

-- Step 5: Add check constraints for data integrity
ALTER TABLE public.accessories 
ADD CONSTRAINT accessories_base_price_positive CHECK (base_price > 0);

ALTER TABLE public.accessories 
ADD CONSTRAINT accessories_multiplier_range CHECK (multiplier >= 1.00 AND multiplier <= 5.00);

-- Step 6: Create trigger function to auto-calculate net_price
CREATE OR REPLACE FUNCTION calculate_accessory_net_price()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-calculate net_price when base_price or multiplier changes
  NEW.net_price = ROUND(NEW.base_price * NEW.multiplier);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create trigger to call the function
DROP TRIGGER IF EXISTS trigger_calculate_accessory_net_price ON public.accessories;
CREATE TRIGGER trigger_calculate_accessory_net_price
  BEFORE INSERT OR UPDATE ON public.accessories
  FOR EACH ROW
  EXECUTE FUNCTION calculate_accessory_net_price();

-- Step 8: Verify the changes
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'accessories' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 9: Test the trigger with a sample update
-- This should automatically calculate net_price = 1000 * 1.50 = 1500
UPDATE public.accessories 
SET base_price = 1000, multiplier = 1.50 
WHERE id = (SELECT id FROM public.accessories LIMIT 1);

-- Verify the calculation worked
SELECT id, name, base_price, multiplier, net_price 
FROM public.accessories 
WHERE base_price = 1000 AND multiplier = 1.50;
