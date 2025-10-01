-- Add Media page to the pages table and grant permissions
-- This page will show all uploaded images from the materials bucket
-- NOTE: Permission checks are currently BYPASSED in the frontend (same as materials page)
-- This SQL is prepared for when permissions are re-enabled

-- Insert the Media page
INSERT INTO pages (path, name, description, parent_category, icon, display_order)
VALUES (
  '/media',
  'Media',
  'Képek kezelése - feltöltés, törlés, listázás',
  'Törzsadatok',
  'ri-image-2-line',
  47  -- After Beszállítók (46)
)
ON CONFLICT (path) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  parent_category = EXCLUDED.parent_category,
  icon = EXCLUDED.icon,
  display_order = EXCLUDED.display_order;

-- Grant permissions to admin users (same as materials page)
-- Get all users who have access to materials page
INSERT INTO user_permissions (user_id, page_id, can_view, can_create, can_update, can_delete)
SELECT 
  up.user_id,
  (SELECT id FROM pages WHERE path = '/media'),
  true,  -- can_view
  true,  -- can_create (upload)
  false, -- can_update (not applicable for media)
  true   -- can_delete
FROM user_permissions up
JOIN pages p ON up.page_id = p.id
WHERE p.path = '/materials'
  AND up.can_view = true
ON CONFLICT (user_id, page_id) DO UPDATE SET
  can_view = EXCLUDED.can_view,
  can_create = EXCLUDED.can_create,
  can_delete = EXCLUDED.can_delete;

-- Verify the changes
SELECT p.path, p.name, COUNT(up.user_id) as users_with_access
FROM pages p
LEFT JOIN user_permissions up ON p.id = up.page_id
WHERE p.path = '/media'
GROUP BY p.id, p.path, p.name;

