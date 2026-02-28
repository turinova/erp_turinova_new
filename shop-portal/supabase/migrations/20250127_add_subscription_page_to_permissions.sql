-- Add Subscription page to permissions system
-- This allows the /subscription page to be accessible through the permission system

INSERT INTO public.pages (path, name, description, category) VALUES
  ('/subscription', 'Előfizetésem', 'Előfizetés és használati statisztikák kezelése', 'Beállítások')
ON CONFLICT (path) DO NOTHING;

-- Grant default access to all existing users for the Subscription page
INSERT INTO public.user_permissions (user_id, page_id, can_access)
SELECT 
  u.id,
  p.id,
  true
FROM auth.users u
CROSS JOIN public.pages p
WHERE p.path = '/subscription'
  AND NOT EXISTS (
    SELECT 1 
    FROM public.user_permissions up 
    WHERE up.user_id = u.id AND up.page_id = p.id
  )
ON CONFLICT (user_id, page_id) DO NOTHING;
