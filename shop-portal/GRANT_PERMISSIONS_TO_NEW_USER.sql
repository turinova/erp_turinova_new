-- Grant permissions to new tenant user
-- Run this in the TENANT database (not Admin DB)
-- Replace the email with the actual user email

-- Step 1: Update existing permissions to can_access = true
UPDATE public.user_permissions
SET can_access = true
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'clouderp@turinova.hu'
)
AND EXISTS (
  SELECT 1 FROM public.pages p 
  WHERE p.id = user_permissions.page_id 
  AND p.is_active = true
);

-- Step 2: Create missing permissions for all active pages
-- This ensures the user has permissions for all pages, even if they weren't created initially
INSERT INTO public.user_permissions (user_id, page_id, can_access)
SELECT 
  (SELECT id FROM auth.users WHERE email = 'clouderp@turinova.hu'),
  p.id,
  true
FROM public.pages p
WHERE p.is_active = true
AND NOT EXISTS (
  SELECT 1 FROM public.user_permissions up
  WHERE up.user_id = (SELECT id FROM auth.users WHERE email = 'clouderp@turinova.hu')
  AND up.page_id = p.id
)
ON CONFLICT (user_id, page_id) DO UPDATE SET can_access = true;

-- Verify the permissions were granted
SELECT 
  p.path,
  p.name,
  up.can_access,
  u.email
FROM public.user_permissions up
JOIN public.pages p ON up.page_id = p.id
JOIN auth.users u ON up.user_id = u.id
WHERE u.email = 'clouderp@turinova.hu'
AND p.is_active = true
ORDER BY p.path;
