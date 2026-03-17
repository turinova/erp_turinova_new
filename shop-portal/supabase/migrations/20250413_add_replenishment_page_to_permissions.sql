-- Add Beszállítói várólista page to permissions system (Beszerzés section)
-- See docs/BESZALLITO_VAROLISTA_IMPLEMENTATION_PLAN.md

INSERT INTO public.pages (path, name, description, category, is_active) VALUES
('/replenishment', 'Beszállítói várólista', 'Rendelési hiányok követése és beszerzési rendelés létrehozása', 'Beszerzés', true)
ON CONFLICT (path) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active;

-- Grant default access to all authenticated users (same as other Beszerzés pages)
INSERT INTO public.user_permissions (user_id, page_id, can_access)
SELECT
  u.id,
  p.id,
  true
FROM auth.users u
CROSS JOIN public.pages p
WHERE p.path = '/replenishment'
AND NOT EXISTS (
  SELECT 1
  FROM public.user_permissions up
  WHERE up.user_id = u.id AND up.page_id = p.id
)
ON CONFLICT (user_id, page_id) DO NOTHING;
