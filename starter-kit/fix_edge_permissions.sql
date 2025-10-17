-- Fix Edge Materials Permission Issues
-- Run this in Supabase SQL Editor to fix the permission problems

-- 1. Add the /edge page to the pages table if it doesn't exist
INSERT INTO pages (path, name, description, category, is_active) VALUES
  ('/edge', 'Élzárók', 'Élzárók kezelése', 'Anyagok', true)
ON CONFLICT (path) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- 2. Add other missing pages that might be needed
INSERT INTO pages (path, name, description, category, is_active) VALUES
  ('/brands', 'Márkák', 'Márkák kezelése', 'Törzsadatok', true),
  ('/currencies', 'Pénznemek', 'Pénznemek kezelése', 'Törzsadatok', true),
  ('/units', 'Mértékegységek', 'Mértékegységek kezelése', 'Törzsadatok', true),
  ('/materials', 'Táblás anyagok', 'Táblás anyagok kezelése', 'Anyagok', true),
  ('/linear-materials', 'Szálas anyagok', 'Szálas anyagok kezelése', 'Anyagok', true),
  ('/opti-settings', 'Opti beállítások', 'Optimalizáló beállítások', 'Eszközök', true)
ON CONFLICT (path) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- 3. Grant access to /edge page for all existing users
-- First, get the page ID for /edge
DO $$
DECLARE
  edge_page_id UUID;
  user_record RECORD;
BEGIN
  -- Get the page ID for /edge
  SELECT id INTO edge_page_id FROM pages WHERE path = '/edge';
  
  IF edge_page_id IS NOT NULL THEN
    -- For each user, add permission for the /edge page
    FOR user_record IN 
      SELECT DISTINCT user_id FROM user_permissions
    LOOP
      -- Insert permission for /edge page (allow view access by default)
      INSERT INTO user_permissions (user_id, page_id, can_view, can_edit, can_delete)
      VALUES (user_record.user_id, edge_page_id, true, true, true)
      ON CONFLICT (user_id, page_id) DO UPDATE SET
        can_view = true,
        can_edit = true,
        can_delete = true,
        updated_at = NOW();
    END LOOP;
    
    RAISE NOTICE 'Added /edge permissions for % users', (SELECT COUNT(*) FROM user_permissions WHERE page_id = edge_page_id);
  ELSE
    RAISE NOTICE 'Edge page not found in pages table';
  END IF;
END $$;

-- 4. Also grant access to other missing pages for all users
DO $$
DECLARE
  page_record RECORD;
  user_record RECORD;
BEGIN
  -- For each page that was just added
  FOR page_record IN 
    SELECT id, path FROM pages WHERE path IN ('/brands', '/currencies', '/units', '/materials', '/linear-materials', '/opti-settings')
  LOOP
    -- For each user, add permission for this page
    FOR user_record IN 
      SELECT DISTINCT user_id FROM user_permissions
    LOOP
      -- Insert permission (allow view access by default)
      INSERT INTO user_permissions (user_id, page_id, can_view, can_edit, can_delete)
      VALUES (user_record.user_id, page_record.id, true, true, true)
      ON CONFLICT (user_id, page_id) DO UPDATE SET
        can_view = true,
        can_edit = true,
        can_delete = true,
        updated_at = NOW();
    END LOOP;
  END LOOP;
END $$;

-- 5. Verify the setup
SELECT 
  p.path,
  p.name,
  p.category,
  COUNT(up.user_id) as user_count
FROM pages p
LEFT JOIN user_permissions up ON p.id = up.page_id
WHERE p.path IN ('/edge', '/brands', '/currencies', '/units', '/materials', '/linear-materials', '/opti-settings')
GROUP BY p.id, p.path, p.name, p.category
ORDER BY p.path;

-- 6. Check if there are any users without permissions
SELECT 
  COUNT(*) as users_without_permissions
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM user_permissions up WHERE up.user_id = u.id
);

-- 7. If there are users without any permissions, add default permissions for them
DO $$
DECLARE
  user_record RECORD;
  page_record RECORD;
BEGIN
  -- For each user without permissions
  FOR user_record IN 
    SELECT u.id FROM auth.users u
    WHERE NOT EXISTS (
      SELECT 1 FROM user_permissions up WHERE up.user_id = u.id
    )
  LOOP
    -- Add permissions for all active pages
    FOR page_record IN 
      SELECT id FROM pages WHERE is_active = true
    LOOP
      INSERT INTO user_permissions (user_id, page_id, can_view, can_edit, can_delete)
      VALUES (user_record.id, page_record.id, true, true, true)
      ON CONFLICT (user_id, page_id) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- 8. Final verification
SELECT 
  'Setup completed successfully' as status,
  COUNT(DISTINCT p.id) as total_pages,
  COUNT(DISTINCT up.user_id) as users_with_permissions,
  COUNT(DISTINCT up.page_id) as pages_with_permissions
FROM pages p
LEFT JOIN user_permissions up ON p.id = up.page_id
WHERE p.is_active = true;
