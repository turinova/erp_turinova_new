-- Add /warehouseoperations page to the permission system
-- Run this in Supabase SQL Editor or via psql

-- Insert the /warehouseoperations page
INSERT INTO pages (path, name, description, category)
VALUES ('/warehouseoperations', 'Műveletek', 'Raktári műveletek kezelése', 'Raktárak')
ON CONFLICT (path) DO NOTHING;

-- Verify the page was added
SELECT * FROM pages WHERE path = '/warehouseoperations';

