-- Add Bolti rendelés felvétel (Shop Order Entry) page to the pages table
-- This page will be a main navigation item

INSERT INTO public.pages (
  path,
  name,
  description,
  category,
  is_active,
  created_at,
  updated_at
) VALUES (
  '/shoporder',
  'Bolti rendelés felvétel',
  'Bolti rendelések felvétele és kezelése',
  'Main',
  true,
  now(),
  now()
);

-- Verify the insertion
SELECT 
  id,
  path,
  name,
  description,
  category,
  is_active,
  created_at
FROM public.pages 
WHERE path = '/shoporder';
