-- Add nickname column to workers table
ALTER TABLE public.workers 
ADD COLUMN nickname character varying(100) NULL;

-- Create index for nickname searches
CREATE INDEX IF NOT EXISTS idx_workers_nickname ON public.workers USING btree (nickname);

-- Update existing workers to have empty nickname (optional)
-- UPDATE public.workers SET nickname = NULL WHERE nickname IS NULL;

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
