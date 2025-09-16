-- Update /tablas-anyagok to /materials in database
-- Run this in Supabase SQL Editor

-- 1. Update the pages table to change the path from /tablas-anyagok to /materials
UPDATE pages 
SET path = '/materials', updated_at = NOW()
WHERE path = '/tablas-anyagok';

-- 2. Verify the update
SELECT 
  path,
  name,
  description,
  category,
  is_active,
  updated_at
FROM pages 
WHERE path = '/materials';

-- 3. Check if there are any user permissions that need to be updated
-- (The permissions should automatically reference the updated page via the page_id)
SELECT 
  p.path,
  p.name,
  COUNT(up.user_id) as user_count
FROM pages p
LEFT JOIN user_permissions up ON p.id = up.page_id
WHERE p.path = '/materials'
GROUP BY p.id, p.path, p.name;

-- 4. Show all pages to verify the change
SELECT 
  path,
  name,
  category,
  is_active
FROM pages 
WHERE path LIKE '%anyagok%' OR path = '/materials'
ORDER BY path;
