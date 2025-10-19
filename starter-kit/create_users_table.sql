-- Create a public users table that mirrors auth.users for permission management
-- This allows us to manage permissions without accessing the auth schema directly

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  last_sign_in_at timestamp with time zone
);

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- Create a function to sync users from auth.users
CREATE OR REPLACE FUNCTION public.sync_user_from_auth()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update user in public.users when auth.users changes
  INSERT INTO public.users (id, email, created_at, updated_at, last_sign_in_at)
  VALUES (NEW.id, NEW.email, NEW.created_at, NEW.updated_at, NEW.last_sign_in_at)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = EXCLUDED.updated_at,
    last_sign_in_at = EXCLUDED.last_sign_in_at;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically sync users
DROP TRIGGER IF EXISTS sync_user_trigger ON auth.users;
CREATE TRIGGER sync_user_trigger
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_from_auth();

-- Insert existing users from auth.users (if any)
INSERT INTO public.users (id, email, created_at, updated_at, last_sign_in_at)
SELECT id, email, created_at, updated_at, last_sign_in_at
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

