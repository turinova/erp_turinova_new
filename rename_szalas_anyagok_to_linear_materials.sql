-- Rename szalas-anyagok URL to linear-materials in pages table
-- This updates the routing and permissions system

-- Update the path in pages table
UPDATE public.pages
SET path = '/linear-materials'
WHERE path = '/szalas-anyagok';

-- Verify the change
SELECT id, path, name, description 
FROM public.pages 
WHERE path = '/linear-materials';

