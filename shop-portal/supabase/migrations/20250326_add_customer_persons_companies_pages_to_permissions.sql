-- Add pages for customer persons and companies to permissions system

-- Add pages
INSERT INTO public.pages (path, name, description, category, is_active)
VALUES 
  ('/customers/persons', 'Személyek', 'Vevő személyek kezelése', 'Vevők', true),
  ('/customers/persons/new', 'Új személy', 'Új vevő személy létrehozása', 'Vevők', true),
  ('/customers/persons/[id]', 'Személy szerkesztése', 'Vevő személy szerkesztése', 'Vevők', true),
  ('/customers/companies', 'Cégek', 'Vevő cégek kezelése', 'Vevők', true),
  ('/customers/companies/new', 'Új cég', 'Új vevő cég létrehozása', 'Vevők', true),
  ('/customers/companies/[id]', 'Cég szerkesztése', 'Vevő cég szerkesztése', 'Vevők', true)
ON CONFLICT (path) DO UPDATE SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active;

-- Grant default access to all authenticated users
INSERT INTO public.user_permissions (user_id, page_id, can_access)
SELECT 
  u.id,
  p.id,
  true
FROM auth.users u
CROSS JOIN public.pages p
WHERE p.path IN (
  '/customers/persons',
  '/customers/persons/new',
  '/customers/persons/[id]',
  '/customers/companies',
  '/customers/companies/new',
  '/customers/companies/[id]'
)
AND NOT EXISTS (
  SELECT 1 
  FROM public.user_permissions up 
  WHERE up.user_id = u.id AND up.page_id = p.id
)
ON CONFLICT (user_id, page_id) DO NOTHING;
