-- Shop Portal Database Setup
-- Run this SQL manually in your Supabase SQL Editor

-- Create pages table
CREATE TABLE IF NOT EXISTS pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create user_permissions table
CREATE TABLE IF NOT EXISTS user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  can_access BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, page_id)
);

-- Create RPC function for getting user permissions
CREATE OR REPLACE FUNCTION get_user_permissions(user_uuid UUID)
RETURNS TABLE (
  page_path VARCHAR,
  can_access BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.path AS page_path,
    COALESCE(up.can_access, false) AS can_access
  FROM pages p
  LEFT JOIN user_permissions up ON p.id = up.page_id AND up.user_id = user_uuid
  ORDER BY p.category, p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert initial pages
INSERT INTO pages (path, name, category) VALUES
  ('/home', 'Kezdőlap', 'Dashboard')
ON CONFLICT (path) DO NOTHING;

-- Grant permissions
GRANT SELECT ON pages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_permissions TO authenticated;

-- Enable Row Level Security (RLS)
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pages
CREATE POLICY "Pages are viewable by authenticated users"
  ON pages FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for user_permissions
CREATE POLICY "Users can view their own permissions"
  ON user_permissions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own permissions"
  ON user_permissions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);
