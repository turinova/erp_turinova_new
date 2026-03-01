-- Add Admin User to Admin Database
-- Run this in your ADMIN DATABASE SQL Editor (Turinova Admin Supabase project)
-- 
-- Instructions:
-- 1. Replace 'your-email@example.com' with the actual email of the user you created in Auth
-- 2. Replace 'Your Full Name' with the user's name (optional, can be NULL)
-- 3. Choose role: 'admin' or 'super_admin' (default is 'admin')
-- 4. Run this SQL in the Admin Database SQL Editor

-- Option 1: Add user with all fields
INSERT INTO public.admin_users (
  email,
  full_name,
  role,
  is_active
)
VALUES (
  'your-email@example.com',  -- Replace with actual email
  'Your Full Name',          -- Replace with actual name (or use NULL)
  'admin',                    -- 'admin' or 'super_admin'
  true                        -- Set to false to disable the user
)
ON CONFLICT (email) DO UPDATE
SET 
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Option 2: Add user with minimal fields (email only)
-- Uncomment and use this if you only have the email:
/*
INSERT INTO public.admin_users (
  email,
  is_active
)
VALUES (
  'your-email@example.com',  -- Replace with actual email
  true
)
ON CONFLICT (email) DO UPDATE
SET 
  is_active = EXCLUDED.is_active,
  updated_at = NOW();
*/

-- Verify the user was added
SELECT 
  id,
  email,
  full_name,
  role,
  is_active,
  created_at,
  updated_at
FROM public.admin_users
WHERE email = 'your-email@example.com';  -- Replace with actual email

-- List all admin users
SELECT 
  id,
  email,
  full_name,
  role,
  is_active,
  created_at
FROM public.admin_users
ORDER BY created_at DESC;
