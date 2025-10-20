-- Add deleted_at column to users table for soft delete functionality
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

-- Create index for faster queries on non-deleted users
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON public.users(deleted_at);

-- Note: We keep the foreign key constraint to auth.users since we're now creating real auth users
-- The constraint ensures data integrity between auth.users and public.users tables

-- Update the sync function to handle deleted_at
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