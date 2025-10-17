-- Add new pages to the pages table
-- Run this SQL manually

INSERT INTO pages (path, name, description, category, is_active, created_at, updated_at) VALUES 
  ('/customer-orders', 'Ügyfél rendelések', 'Ügyfél rendelések kezelése', 'orders', true, NOW(), NOW()),
  ('/supplier-orders', 'Beszállítói rendelések', 'Beszállítói rendelések kezelése', 'orders', true, NOW(), NOW());
