-- Add /home page to the pages table for permission management
-- This allows admins to grant/revoke access to the home page

INSERT INTO public.pages (path, name, description, category, is_active)
VALUES ('/home', 'Kezdőlap', 'Főoldal / Dashboard', 'Általános', TRUE)
ON CONFLICT (path) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- Optional: Grant /home permission to all existing users
-- Uncomment the following lines if you want to automatically grant home access to all users:

-- INSERT INTO public.user_permissions (user_id, page_id)
-- SELECT u.id, p.id
-- FROM public.users u
-- CROSS JOIN public.pages p
-- WHERE p.path = '/home'
--   AND u.deleted_at IS NULL
--   AND NOT EXISTS (
--     SELECT 1 FROM public.user_permissions up
--     WHERE up.user_id = u.id AND up.page_id = p.id
--   );

