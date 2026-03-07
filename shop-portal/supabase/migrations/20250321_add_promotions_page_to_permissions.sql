-- Add promotions page to permission system
-- Run this SQL manually in your Supabase SQL Editor

-- Add promotions page
INSERT INTO public.pages (path, name, description, category, is_active)
VALUES (
  '/promotions',
  'Akciók',
  'Termék akciók és mennyiségi árazás kezelése',
  'Árszabás',
  true
)
ON CONFLICT (path) DO NOTHING;

-- Grant default access to all existing users for the Promotions page
INSERT INTO public.user_permissions (user_id, page_id, can_access)
SELECT 
  u.id,
  p.id,
  true
FROM auth.users u
CROSS JOIN public.pages p
WHERE p.path = '/promotions'
  AND NOT EXISTS (
    SELECT 1 
    FROM public.user_permissions up 
    WHERE up.user_id = u.id AND up.page_id = p.id
  )
ON CONFLICT (user_id, page_id) DO NOTHING;
