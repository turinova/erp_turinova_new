-- Add holidays page to pages table for permission system
INSERT INTO public.pages (path, name, description, category, is_active)
VALUES (
  '/holidays',
  'Ünnepek',
  'Nemzeti és céges ünnepek kezelése',
  'HR',
  true
)
ON CONFLICT (path) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- Grant all users permission to access the /holidays page
DO $$
DECLARE
  user_record RECORD;
  page_id_var uuid;
BEGIN
  -- Get the page ID for /holidays
  SELECT id INTO page_id_var FROM pages WHERE path = '/holidays';
  
  -- Grant permission to all existing users
  FOR user_record IN SELECT id FROM auth.users WHERE deleted_at IS NULL
  LOOP
    INSERT INTO user_permissions (user_id, page_id, can_access)
    VALUES (user_record.id, page_id_var, true)
    ON CONFLICT (user_id, page_id) DO UPDATE SET can_access = true;
  END LOOP;
END $$;
