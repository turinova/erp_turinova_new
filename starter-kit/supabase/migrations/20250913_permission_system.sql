-- Permission System Migration
-- Creates tables for page-based permission control

-- Pages table - stores all available pages in the system
CREATE TABLE IF NOT EXISTS pages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  path VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User permissions table - stores individual user permissions for pages
CREATE TABLE IF NOT EXISTS user_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  can_view BOOLEAN DEFAULT false,
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, page_id)
);

-- Insert default pages
INSERT INTO pages (path, name, description, category) VALUES
  ('/home', 'Főoldal', 'Rendszer főoldala', 'Általános'),
  ('/company', 'Cégadatok', 'Cégadatok kezelése', 'Törzsadatok'),
  ('/customers', 'Ügyfelek', 'Ügyfelek kezelése', 'Törzsadatok'),
  ('/vat', 'Adónemek', 'Adónemek kezelése', 'Törzsadatok'),
  ('/users', 'Felhasználók', 'Felhasználók kezelése', 'Rendszer'),
  ('/opti', 'Optimalizáló', 'Optimalizáló eszköz', 'Eszközök'),
  ('/optimalizalo', 'Optimalizáló', 'Optimalizáló eszköz', 'Eszközök')
ON CONFLICT (path) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_page_id ON user_permissions(page_id);
CREATE INDEX IF NOT EXISTS idx_pages_path ON pages(path);
CREATE INDEX IF NOT EXISTS idx_pages_active ON pages(is_active);

-- Create function to get user permissions
CREATE OR REPLACE FUNCTION get_user_permissions(user_uuid UUID)
RETURNS TABLE (
  page_path VARCHAR(255),
  page_name VARCHAR(255),
  can_view BOOLEAN,
  can_edit BOOLEAN,
  can_delete BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.path,
    p.name,
    COALESCE(up.can_view, false) as can_view,
    COALESCE(up.can_edit, false) as can_edit,
    COALESCE(up.can_delete, false) as can_delete
  FROM pages p
  LEFT JOIN user_permissions up ON p.id = up.page_id AND up.user_id = user_uuid
  WHERE p.is_active = true
  ORDER BY p.category, p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user has permission for a page
CREATE OR REPLACE FUNCTION has_page_permission(user_uuid UUID, page_path VARCHAR(255), permission_type VARCHAR(20))
RETURNS BOOLEAN AS $$
DECLARE
  has_permission BOOLEAN := false;
BEGIN
  SELECT CASE 
    WHEN permission_type = 'view' THEN up.can_view
    WHEN permission_type = 'edit' THEN up.can_edit
    WHEN permission_type = 'delete' THEN up.can_delete
    ELSE false
  END INTO has_permission
  FROM pages p
  LEFT JOIN user_permissions up ON p.id = up.page_id AND up.user_id = user_uuid
  WHERE p.path = page_path AND p.is_active = true;
  
  RETURN COALESCE(has_permission, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to set first user as admin
CREATE OR REPLACE FUNCTION set_first_user_as_admin()
RETURNS VOID AS $$
DECLARE
  first_user_id UUID;
  page_record RECORD;
BEGIN
  -- Get the first user (oldest by created_at)
  SELECT id INTO first_user_id 
  FROM auth.users 
  ORDER BY created_at ASC 
  LIMIT 1;
  
  IF first_user_id IS NOT NULL THEN
    -- Give admin permissions to all pages
    FOR page_record IN SELECT id FROM pages WHERE is_active = true LOOP
      INSERT INTO user_permissions (user_id, page_id, can_view, can_edit, can_delete)
      VALUES (first_user_id, page_record.id, true, true, true)
      ON CONFLICT (user_id, page_id) DO UPDATE SET
        can_view = true,
        can_edit = true,
        can_delete = true,
        updated_at = NOW();
    END LOOP;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set first user as admin
SELECT set_first_user_as_admin();

-- Create RLS policies
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- Pages are readable by authenticated users
CREATE POLICY "Pages are readable by authenticated users" ON pages
  FOR SELECT USING (auth.role() = 'authenticated');

-- User permissions are readable by the user themselves
CREATE POLICY "Users can read their own permissions" ON user_permissions
  FOR SELECT USING (auth.uid() = user_id);

-- Only admins can manage user permissions
CREATE POLICY "Only admins can manage user permissions" ON user_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_permissions up
      JOIN pages p ON up.page_id = p.id
      WHERE up.user_id = auth.uid() 
      AND p.path = '/users' 
      AND up.can_edit = true
    )
  );
