-- Simple permission setup script
-- Run this directly in Supabase SQL editor

-- Create pages table
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

-- Create user permissions table
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_page_id ON user_permissions(page_id);
CREATE INDEX IF NOT EXISTS idx_pages_path ON pages(path);

-- Enable RLS
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Pages are readable by authenticated users" ON pages
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can read their own permissions" ON user_permissions
  FOR SELECT USING (auth.uid() = user_id);

-- Give first user admin permissions
DO $$
DECLARE
  first_user_id UUID;
  page_record RECORD;
BEGIN
  -- Get the first user
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
END $$;
