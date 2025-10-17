-- Update /opti-beallitasok to /opti-settings in database
-- Run this in Supabase SQL Editor

-- 1. Check if the old path exists
SELECT 
  id,
  path,
  name,
  description,
  category,
  is_active,
  created_at,
  updated_at
FROM pages 
WHERE path = '/opti-beallitasok';

-- 2. Update the pages table to change the path from /opti-beallitasok to /opti-settings
UPDATE pages 
SET 
  path = '/opti-settings', 
  updated_at = NOW()
WHERE path = '/opti-beallitasok';

-- 3. Verify the update was successful
SELECT 
  id,
  path,
  name,
  description,
  category,
  is_active,
  created_at,
  updated_at
FROM pages 
WHERE path = '/opti-settings';

-- 4. Check if there are any user permissions that reference this page
-- (The permissions should automatically reference the updated page via the page_id)
SELECT 
  p.id as page_id,
  p.path,
  p.name,
  COUNT(up.user_id) as user_count,
  COUNT(CASE WHEN up.can_view = true THEN 1 END) as can_view_count,
  COUNT(CASE WHEN up.can_edit = true THEN 1 END) as can_edit_count,
  COUNT(CASE WHEN up.can_delete = true THEN 1 END) as can_delete_count
FROM pages p
LEFT JOIN user_permissions up ON p.id = up.page_id
WHERE p.path = '/opti-settings'
GROUP BY p.id, p.path, p.name;

-- 5. Show all opti-related pages to verify the change
SELECT 
  id,
  path,
  name,
  category,
  is_active,
  updated_at
FROM pages 
WHERE path LIKE '%opti%'
ORDER BY path;

-- 6. Check if there are any remaining references to the old path
SELECT 
  path,
  name,
  category,
  is_active
FROM pages 
WHERE path = '/opti-beallitasok';
