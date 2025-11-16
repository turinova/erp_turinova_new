-- Add /product-suggestions page to the permission system
-- Run this in Supabase SQL Editor or via psql

INSERT INTO public.pages (path, name, description, category)
VALUES ('/product-suggestions', 'Termék javaslatok', 'Termék javaslatok kezelése', 'Törzsadatok')
ON CONFLICT (path) DO NOTHING;

-- Verify
SELECT * FROM public.pages WHERE path = '/product-suggestions';


