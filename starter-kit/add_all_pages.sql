-- Add all missing pages to the system
-- Run this in Supabase SQL editor

INSERT INTO pages (path, name, description, category, is_active) VALUES
  -- Existing pages (update if needed)
  ('/home', 'Főoldal', 'Rendszer főoldala', 'Általános', true),
  ('/company', 'Cégadatok', 'Cégadatok kezelése', 'Törzsadatok', true),
  ('/customers', 'Ügyfelek', 'Ügyfelek kezelése', 'Törzsadatok', true),
  ('/vat', 'Adónemek', 'Adónemek kezelése', 'Törzsadatok', true),
  ('/users', 'Felhasználók', 'Felhasználók kezelése', 'Rendszer', true),
  ('/opti', 'Optimalizáló', 'Optimalizáló eszköz', 'Eszközök', true),
  ('/optimalizalo', 'Optimalizáló', 'Optimalizáló eszköz', 'Eszközök', true),
  
  -- Missing pages from navigation
  ('/brands', 'Márkák', 'Márkák kezelése', 'Törzsadatok', true),
  ('/currencies', 'Pénznemek', 'Pénznemek kezelése', 'Törzsadatok', true),
  ('/units', 'Mértékegységek', 'Mértékegységek kezelése', 'Törzsadatok', true),
  ('/materials', 'Táblás anyagok', 'Táblás anyagok kezelése', 'Anyagok', true),
  ('/linear-materials', 'Szálas anyagok', 'Szálas anyagok kezelése', 'Anyagok', true),
  ('/edge', 'Elzárók', 'Elzárók kezelése', 'Anyagok', true),
  ('/opti-settings', 'Opti beállítások', 'Optimalizáló beállítások', 'Eszközök', true)
ON CONFLICT (path) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Update existing user permissions to include all new pages
DO $$
DECLARE
  user_record RECORD;
  page_record RECORD;
BEGIN
  -- For each user, add permissions for all pages
  FOR user_record IN SELECT DISTINCT user_id FROM user_permissions LOOP
    FOR page_record IN SELECT id, path FROM pages WHERE is_active = true LOOP
      -- Check if permission already exists
      IF NOT EXISTS (
        SELECT 1 FROM user_permissions 
        WHERE user_id = user_record.user_id AND page_id = page_record.id
      ) THEN
        -- Add new permission (default to false for new pages)
        INSERT INTO user_permissions (user_id, page_id, can_view, can_edit, can_delete)
        VALUES (
          user_record.user_id,
          page_record.id,
          CASE 
            WHEN page_record.path = '/' THEN true  -- Home is always visible
            WHEN page_record.path = '/home' THEN true  -- Home is always visible
            ELSE false  -- New pages default to not visible
          END,
          false,  -- No edit by default
          false   -- No delete by default
        );
      END IF;
    END LOOP;
  END LOOP;
END $$;
