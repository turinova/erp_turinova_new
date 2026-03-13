-- Add customer management pages to permissions system
-- These pages will be under a new "Vevők" navigation section

INSERT INTO public.pages (path, name, description, category, is_active) VALUES
('/customers', 'Vevők', 'Vevők és cégek kezelése', 'Vevők', true),
('/customers/new', 'Új vevő', 'Új vevő vagy cég létrehozása', 'Vevők', true),
('/customers/[id]', 'Vevő részletei', 'Vevő vagy cég részleteinek megtekintése és szerkesztése', 'Vevők', true)
ON CONFLICT (path) DO UPDATE SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active;

-- Grant default access to all existing users for customer pages
INSERT INTO public.user_permissions (user_id, page_id, can_access)
SELECT 
  u.id,
  p.id,
  true
FROM auth.users u
CROSS JOIN public.pages p
WHERE p.path IN ('/customers', '/customers/new', '/customers/[id]')
  AND NOT EXISTS (
    SELECT 1 
    FROM public.user_permissions up 
    WHERE up.user_id = u.id AND up.page_id = p.id
  )
ON CONFLICT (user_id, page_id) DO NOTHING;
