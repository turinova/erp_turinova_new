-- Add Kereső (Search) page to the system
-- Run this in Supabase SQL editor

INSERT INTO pages (path, name, description, category, is_active) VALUES
  ('/search', 'Kereső', 'Kereső funkció', 'Általános', true)
ON CONFLICT (path) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Verify the page was added
SELECT * FROM pages WHERE path = '/search';
