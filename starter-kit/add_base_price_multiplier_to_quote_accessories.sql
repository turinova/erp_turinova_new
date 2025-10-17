-- Add base_price and multiplier columns to quote_accessories table
-- This allows storing the pricing components separately for each quote accessory

-- Add the new columns
ALTER TABLE public.quote_accessories
ADD COLUMN base_price INTEGER,
ADD COLUMN multiplier DECIMAL(3,2);

-- Update existing records with calculated values
-- For existing records, we'll calculate base_price from unit_price_net using default multiplier 1.38
UPDATE public.quote_accessories
SET
  base_price = ROUND(unit_price_net / 1.38),
  multiplier = 1.38
WHERE
  base_price IS NULL OR multiplier IS NULL;

-- Make the columns NOT NULL after populating existing data
ALTER TABLE public.quote_accessories
ALTER COLUMN base_price SET NOT NULL,
ALTER COLUMN multiplier SET NOT NULL;

-- Add default value for multiplier
ALTER TABLE public.quote_accessories
ALTER COLUMN multiplier SET DEFAULT 1.38;

-- Add check constraints
ALTER TABLE public.quote_accessories
ADD CONSTRAINT chk_quote_accessories_multiplier_range CHECK (multiplier >= 1.00 AND multiplier <= 5.00);

ALTER TABLE public.quote_accessories
ADD CONSTRAINT chk_quote_accessories_base_price_positive CHECK (base_price >= 0);

-- Update the comment
COMMENT ON COLUMN public.quote_accessories.base_price IS 'Base price component for calculating net price (base_price × multiplier)';
COMMENT ON COLUMN public.quote_accessories.multiplier IS 'Multiplier component for calculating net price (base_price × multiplier)';

-- Verify the changes
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'quote_accessories' 
  AND column_name IN ('base_price', 'multiplier')
ORDER BY ordinal_position;
