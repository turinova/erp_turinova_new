-- Add color column to workers table
ALTER TABLE public.workers 
ADD COLUMN color character varying(7) NULL DEFAULT '#1976d2';

-- Create index for color searches (optional)
CREATE INDEX IF NOT EXISTS idx_workers_color ON public.workers USING btree (color);

-- Update existing workers to have default color
UPDATE public.workers 
SET color = '#1976d2' 
WHERE color IS NULL;

-- Verify the column was added
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'workers' 
  AND table_schema = 'public'
ORDER BY ordinal_position;
