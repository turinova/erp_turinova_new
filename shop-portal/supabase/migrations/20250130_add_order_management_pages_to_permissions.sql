-- Add pages for order management to permissions system

-- Add pages
INSERT INTO public.pages (path, name, description, category, is_active)
VALUES 
  ('/orders/buffer', 'Rendelés puffer', 'Webes rendelések áttekintése és feldolgozása', 'Rendelések', true),
  ('/orders', 'Rendelések', 'Rendelések listázása', 'Rendelések', true),
  ('/orders/new', 'Új rendelés', 'Kézi rendelés létrehozása', 'Rendelések', true),
  ('/orders/[id]', 'Rendelés részletei', 'Rendelés megtekintése és szerkesztése', 'Rendelések', true),
  ('/shipping-methods', 'Szállítási módok', 'Szállítási módok kezelése', 'Törzsadatok', true),
  ('/shipping-methods/new', 'Új szállítási mód', 'Új szállítási mód létrehozása', 'Törzsadatok', true),
  ('/shipping-methods/[id]', 'Szállítási mód szerkesztése', 'Szállítási mód szerkesztése', 'Törzsadatok', true)
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
  '/orders/buffer',
  '/orders',
  '/orders/new',
  '/orders/[id]',
  '/shipping-methods',
  '/shipping-methods/new',
  '/shipping-methods/[id]'
)
AND NOT EXISTS (
  SELECT 1 
  FROM public.user_permissions up 
  WHERE up.user_id = u.id AND up.page_id = p.id
)
ON CONFLICT (user_id, page_id) DO NOTHING;
