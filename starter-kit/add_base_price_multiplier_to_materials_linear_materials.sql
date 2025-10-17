-- Migration script to add base_price, multiplier, partners_id, and units_id columns
-- to materials and linear_materials tables

-- =============================================
-- MATERIALS TABLE MODIFICATIONS
-- =============================================

-- Add new columns to materials table
ALTER TABLE public.materials 
ADD COLUMN base_price integer,
ADD COLUMN multiplier numeric(3, 2) DEFAULT 1.38,
ADD COLUMN partners_id uuid,
ADD COLUMN units_id uuid;

-- Add foreign key constraints for materials
ALTER TABLE public.materials 
ADD CONSTRAINT materials_partners_id_fkey 
FOREIGN KEY (partners_id) REFERENCES partners (id) ON DELETE RESTRICT;

ALTER TABLE public.materials 
ADD CONSTRAINT materials_units_id_fkey 
FOREIGN KEY (units_id) REFERENCES units (id) ON DELETE RESTRICT;

-- Add check constraints for materials
ALTER TABLE public.materials 
ADD CONSTRAINT materials_base_price_positive 
CHECK (base_price > 0);

ALTER TABLE public.materials 
ADD CONSTRAINT materials_multiplier_range 
CHECK (multiplier >= 1.00 AND multiplier <= 5.00);

-- Set default units_id to 'tábla' (assuming it's the latest record in units table)
-- First, let's find the tábla unit ID and set it as default
UPDATE public.materials 
SET units_id = (SELECT id FROM units WHERE name = 'tábla' ORDER BY created_at DESC LIMIT 1)
WHERE units_id IS NULL;

-- Verify that all records now have units_id before making it NOT NULL
-- If there are still NULL values, we need to handle them
DO $$
DECLARE
    null_count integer;
    default_unit_id uuid;
BEGIN
    -- Check if there are any NULL units_id values
    SELECT COUNT(*) INTO null_count FROM public.materials WHERE units_id IS NULL;
    
    IF null_count > 0 THEN
        -- Get the first available unit ID as fallback
        SELECT id INTO default_unit_id FROM public.units ORDER BY created_at DESC LIMIT 1;
        
        -- Update any remaining NULL values
        UPDATE public.materials 
        SET units_id = default_unit_id
        WHERE units_id IS NULL;
        
        RAISE NOTICE 'Updated % records with default unit_id', null_count;
    END IF;
END $$;

-- Make units_id NOT NULL after setting defaults
ALTER TABLE public.materials 
ALTER COLUMN units_id SET NOT NULL;

-- Calculate base_price from existing price_per_sqm data
-- base_price = price_per_sqm / 1.38 (rounded to integer)
UPDATE public.materials 
SET base_price = ROUND(price_per_sqm / 1.38)::integer
WHERE base_price IS NULL AND price_per_sqm > 0;

-- Handle records with price_per_sqm = 0 or NULL by setting base_price = 1
UPDATE public.materials 
SET base_price = 1
WHERE base_price IS NULL;

-- Set multiplier to 1.38 for existing records
UPDATE public.materials 
SET multiplier = 1.38
WHERE multiplier IS NULL;

-- Verify that all records now have base_price and multiplier before making them NOT NULL
DO $$
DECLARE
    null_base_price_count integer;
    null_multiplier_count integer;
BEGIN
    -- Check if there are any NULL base_price values
    SELECT COUNT(*) INTO null_base_price_count FROM public.materials WHERE base_price IS NULL;
    
    -- Check if there are any NULL multiplier values
    SELECT COUNT(*) INTO null_multiplier_count FROM public.materials WHERE multiplier IS NULL;
    
    IF null_base_price_count > 0 OR null_multiplier_count > 0 THEN
        RAISE EXCEPTION 'Still have NULL values: base_price=% records, multiplier=% records', 
            null_base_price_count, null_multiplier_count;
    END IF;
END $$;

-- Make base_price and multiplier NOT NULL after setting defaults
ALTER TABLE public.materials 
ALTER COLUMN base_price SET NOT NULL,
ALTER COLUMN multiplier SET NOT NULL;

-- Add indexes for materials
CREATE INDEX IF NOT EXISTS idx_materials_base_price ON public.materials USING btree (base_price);
CREATE INDEX IF NOT EXISTS idx_materials_multiplier ON public.materials USING btree (multiplier);
CREATE INDEX IF NOT EXISTS idx_materials_partners_id ON public.materials USING btree (partners_id);
CREATE INDEX IF NOT EXISTS idx_materials_units_id ON public.materials USING btree (units_id);

-- =============================================
-- LINEAR_MATERIALS TABLE MODIFICATIONS
-- =============================================

-- Add new columns to linear_materials table
ALTER TABLE public.linear_materials 
ADD COLUMN base_price integer,
ADD COLUMN multiplier numeric(3, 2) DEFAULT 1.38,
ADD COLUMN partners_id uuid,
ADD COLUMN units_id uuid;

-- Add foreign key constraints for linear_materials
ALTER TABLE public.linear_materials 
ADD CONSTRAINT linear_materials_partners_id_fkey 
FOREIGN KEY (partners_id) REFERENCES partners (id) ON DELETE RESTRICT;

ALTER TABLE public.linear_materials 
ADD CONSTRAINT linear_materials_units_id_fkey 
FOREIGN KEY (units_id) REFERENCES units (id) ON DELETE RESTRICT;

-- Add check constraints for linear_materials
ALTER TABLE public.linear_materials 
ADD CONSTRAINT linear_materials_base_price_positive 
CHECK (base_price > 0);

ALTER TABLE public.linear_materials 
ADD CONSTRAINT linear_materials_multiplier_range 
CHECK (multiplier >= 1.00 AND multiplier <= 5.00);

-- Set default units_id to 'tábla' for linear_materials as well
UPDATE public.linear_materials 
SET units_id = (SELECT id FROM units WHERE name = 'tábla' ORDER BY created_at DESC LIMIT 1)
WHERE units_id IS NULL;

-- Verify that all records now have units_id before making it NOT NULL
-- If there are still NULL values, we need to handle them
DO $$
DECLARE
    null_count integer;
    default_unit_id uuid;
BEGIN
    -- Check if there are any NULL units_id values
    SELECT COUNT(*) INTO null_count FROM public.linear_materials WHERE units_id IS NULL;
    
    IF null_count > 0 THEN
        -- Get the first available unit ID as fallback
        SELECT id INTO default_unit_id FROM public.units ORDER BY created_at DESC LIMIT 1;
        
        -- Update any remaining NULL values
        UPDATE public.linear_materials 
        SET units_id = default_unit_id
        WHERE units_id IS NULL;
        
        RAISE NOTICE 'Updated % linear_materials records with default unit_id', null_count;
    END IF;
END $$;

-- Make units_id NOT NULL after setting defaults
ALTER TABLE public.linear_materials 
ALTER COLUMN units_id SET NOT NULL;

-- Calculate base_price from existing price_per_m data
-- base_price = price_per_m / 1.38 (rounded to integer)
UPDATE public.linear_materials 
SET base_price = ROUND(price_per_m / 1.38)::integer
WHERE base_price IS NULL AND price_per_m > 0;

-- Handle records with price_per_m = 0 or NULL by setting base_price = 1
UPDATE public.linear_materials 
SET base_price = 1
WHERE base_price IS NULL;

-- Set multiplier to 1.38 for existing records
UPDATE public.linear_materials 
SET multiplier = 1.38
WHERE multiplier IS NULL;

-- Verify that all records now have base_price and multiplier before making them NOT NULL
DO $$
DECLARE
    null_base_price_count integer;
    null_multiplier_count integer;
BEGIN
    -- Check if there are any NULL base_price values
    SELECT COUNT(*) INTO null_base_price_count FROM public.linear_materials WHERE base_price IS NULL;
    
    -- Check if there are any NULL multiplier values
    SELECT COUNT(*) INTO null_multiplier_count FROM public.linear_materials WHERE multiplier IS NULL;
    
    IF null_base_price_count > 0 OR null_multiplier_count > 0 THEN
        RAISE EXCEPTION 'Still have NULL values in linear_materials: base_price=% records, multiplier=% records', 
            null_base_price_count, null_multiplier_count;
    END IF;
END $$;

-- Make base_price and multiplier NOT NULL after setting defaults
ALTER TABLE public.linear_materials 
ALTER COLUMN base_price SET NOT NULL,
ALTER COLUMN multiplier SET NOT NULL;

-- Add indexes for linear_materials
CREATE INDEX IF NOT EXISTS idx_linear_materials_base_price ON public.linear_materials USING btree (base_price);
CREATE INDEX IF NOT EXISTS idx_linear_materials_multiplier ON public.linear_materials USING btree (multiplier);
CREATE INDEX IF NOT EXISTS idx_linear_materials_partners_id ON public.linear_materials USING btree (partners_id);
CREATE INDEX IF NOT EXISTS idx_linear_materials_units_id ON public.linear_materials USING btree (units_id);

-- =============================================
-- TRIGGER FUNCTIONS FOR PRICE CALCULATION
-- =============================================

-- Create trigger function for materials price calculation
CREATE OR REPLACE FUNCTION calculate_materials_price_per_sqm()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate price_per_sqm from base_price * multiplier
    NEW.price_per_sqm = ROUND((NEW.base_price * NEW.multiplier)::numeric, 2);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function for linear_materials price calculation
CREATE OR REPLACE FUNCTION calculate_linear_materials_price_per_m()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate price_per_m from base_price * multiplier
    NEW.price_per_m = ROUND((NEW.base_price * NEW.multiplier)::numeric, 2);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for materials
CREATE TRIGGER trigger_calculate_materials_price_per_sqm
    BEFORE INSERT OR UPDATE ON materials
    FOR EACH ROW
    EXECUTE FUNCTION calculate_materials_price_per_sqm();

-- Add triggers for linear_materials
CREATE TRIGGER trigger_calculate_linear_materials_price_per_m
    BEFORE INSERT OR UPDATE ON linear_materials
    FOR EACH ROW
    EXECUTE FUNCTION calculate_linear_materials_price_per_m();

-- =============================================
-- VERIFICATION QUERIES
-- =============================================

-- Verify materials table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'materials' 
    AND table_schema = 'public'
    AND column_name IN ('base_price', 'multiplier', 'partners_id', 'units_id')
ORDER BY column_name;

-- Verify linear_materials table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'linear_materials' 
    AND table_schema = 'public'
    AND column_name IN ('base_price', 'multiplier', 'partners_id', 'units_id')
ORDER BY column_name;

-- Test price calculation for materials
SELECT 
    name,
    base_price,
    multiplier,
    price_per_sqm,
    ROUND((base_price * multiplier)::numeric, 2) as calculated_price_per_sqm
FROM materials 
LIMIT 5;

-- Test price calculation for linear_materials
SELECT 
    name,
    base_price,
    multiplier,
    price_per_m,
    ROUND((base_price * multiplier)::numeric, 2) as calculated_price_per_m
FROM linear_materials 
LIMIT 5;
