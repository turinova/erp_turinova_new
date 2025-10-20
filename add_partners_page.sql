-- Add /partners page to the permission system
-- Run this in Supabase SQL Editor or via psql

-- Insert the /partners page
INSERT INTO pages (path, name, description, category) 
VALUES ('/partners', 'Partnerek', 'Beszállítók kezelése', 'Törzsadatok')
ON CONFLICT (path) DO NOTHING;

-- Verify the page was added
SELECT * FROM pages WHERE path = '/partners';
