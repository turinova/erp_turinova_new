-- Add machine_threshold column to cutting_fees table
ALTER TABLE public.cutting_fees
ADD COLUMN IF NOT EXISTS machine_threshold numeric(10, 4) DEFAULT 0.35;

-- Update existing row with default value if null
UPDATE public.cutting_fees
SET machine_threshold = 0.35
WHERE machine_threshold IS NULL;
