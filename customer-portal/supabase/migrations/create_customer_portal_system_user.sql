-- =====================================================
-- CREATE CUSTOMER PORTAL SYSTEM USER
-- =====================================================
-- This creates a system user in the COMPANY database
-- to be used as created_by for customer portal quotes.
-- 
-- ⚠️ RUN THIS IN EACH COMPANY DATABASE (NOT PORTAL DB)
-- =====================================================

-- First, check if the user already exists
DO $$
DECLARE
  system_user_id UUID;
BEGIN
  -- Try to find existing system user
  SELECT id INTO system_user_id
  FROM auth.users
  WHERE email = 'customer-portal-system@turinova.internal';
  
  -- If not found, create it
  IF system_user_id IS NULL THEN
    -- Insert into auth.users
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      'c0000000-0000-0000-0000-000000000001', -- Fixed UUID for customer portal system
      'authenticated',
      'authenticated',
      'customer-portal-system@turinova.internal',
      '$2a$10$XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', -- Dummy password (login disabled)
      NOW(),
      '{"provider": "system", "providers": ["system"]}'::jsonb,
      '{"full_name": "Customer Portal System", "is_system_user": true}'::jsonb,
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    )
    ON CONFLICT (id) DO NOTHING;
    
    RAISE NOTICE 'Customer Portal System User created with ID: c0000000-0000-0000-0000-000000000001';
  ELSE
    RAISE NOTICE 'Customer Portal System User already exists with ID: %', system_user_id;
  END IF;
END $$;

-- Verify the user was created
SELECT id, email, raw_user_meta_data->>'full_name' as name
FROM auth.users
WHERE email = 'customer-portal-system@turinova.internal';

