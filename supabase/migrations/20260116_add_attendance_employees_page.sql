-- Add employees page to pages table for permission system
-- First, update any existing /attendance/employees page to /employees
UPDATE public.pages 
SET path = '/employees',
    name = 'Kollégák',
    description = 'Dolgozók kezelése és jelenléti adatok',
    category = 'HR',
    is_active = true,
    updated_at = now()
WHERE path = '/attendance/employees';

-- Then insert if it doesn't exist
INSERT INTO public.pages (path, name, description, category, is_active)
VALUES (
  '/employees',
  'Kollégák',
  'Dolgozók kezelése és jelenléti adatok',
  'HR',
  true
)
ON CONFLICT (path) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- Update user_permissions to point to the new page path
UPDATE public.user_permissions up
SET page_id = (SELECT id FROM public.pages WHERE path = '/employees'),
    updated_at = now()
WHERE up.page_id = (SELECT id FROM public.pages WHERE path = '/attendance/employees');
