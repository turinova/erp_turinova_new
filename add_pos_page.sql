-- Add /pos page to the permission system
-- Run this in Supabase SQL Editor or via psql

-- Insert the /pos page
INSERT INTO pages (path, name, description, category)
VALUES ('/pos', 'Pos', 'Pénztár rendszer', 'Általános')
ON CONFLICT (path) DO NOTHING;

-- Verify the page was added
SELECT * FROM pages WHERE path = '/pos';

