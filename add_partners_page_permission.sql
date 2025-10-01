-- Add partners page to the permission system
INSERT INTO pages (path, name, description, category) VALUES
  ('/partners', 'Beszállítók', 'Beszállítók kezelése', 'Törzsadatok')
ON CONFLICT (path) DO NOTHING;

-- Give all existing users view permission for the partners page
INSERT INTO user_permissions (user_id, page_id, can_view, can_edit, can_delete)
SELECT 
  u.id as user_id,
  p.id as page_id,
  true as can_view,
  true as can_edit,
  true as can_delete
FROM auth.users u
CROSS JOIN pages p
WHERE p.path = '/partners'
ON CONFLICT (user_id, page_id) DO UPDATE SET
  can_view = true,
  can_edit = true,
  can_delete = true,
  updated_at = NOW();
