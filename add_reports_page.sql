-- Add /reports page to the permission system
-- Run this in Supabase SQL Editor or via psql

-- Insert the /reports page
INSERT INTO pages (path, name, description, category)
VALUES ('/reports', 'Riportok', 'Riportok és kimutatások áttekintése', 'Riportok')
ON CONFLICT (path) DO NOTHING;

-- Verify the page was added
SELECT * FROM pages WHERE path = '/reports';

