-- Add Quotes page to the system
-- Run this in Supabase SQL editor

INSERT INTO pages (path, name, description, category, is_active) VALUES
  ('/quotes', 'Ajánlatok', 'Árajánlatok kezelése és áttekintése', 'Eszközök', true)
ON CONFLICT (path) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Add permissions for all existing users to the new page
DO $$
DECLARE
  user_record RECORD;
  quotes_page_id UUID;
BEGIN
  -- Get the page ID for quotes
  SELECT id INTO quotes_page_id FROM pages WHERE path = '/quotes';
  
  -- For each user, add permission for the quotes page
  FOR user_record IN SELECT DISTINCT user_id FROM user_permissions LOOP
    -- Check if permission already exists
    IF NOT EXISTS (
      SELECT 1 FROM user_permissions 
      WHERE user_id = user_record.user_id AND page_id = quotes_page_id
    ) THEN
      -- Add new permission (default to true for view, false for edit/delete)
      INSERT INTO user_permissions (user_id, page_id, can_view, can_edit, can_delete)
      VALUES (
        user_record.user_id,
        quotes_page_id,
        true,   -- Can view (since it's under Opti menu)
        false,  -- No edit by default
        false   -- No delete by default
      );
    END IF;
  END LOOP;
END $$;
