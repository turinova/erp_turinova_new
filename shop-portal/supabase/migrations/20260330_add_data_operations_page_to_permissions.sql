-- Add Data Operations page to permissions system
-- Top-level navigation page for reusable XLSX import/export workflows

INSERT INTO public.pages (path, name, description, category, is_active) VALUES
  ('/data-operations', 'Adatműveletek', 'Központi XLSX import/export műveletek', 'Műveletek', true)
ON CONFLICT (path) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active;

-- Grant default access for existing users
INSERT INTO public.user_permissions (user_id, page_id, can_access)
SELECT
  u.id,
  p.id,
  true
FROM auth.users u
CROSS JOIN public.pages p
WHERE p.path = '/data-operations'
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_permissions up
    WHERE up.user_id = u.id AND up.page_id = p.id
  )
ON CONFLICT (user_id, page_id) DO NOTHING;
