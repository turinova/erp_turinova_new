-- Setup Supabase Storage for Tenant Company Logo
-- Run this in Supabase SQL Editor
-- 
-- SAFE TO RUN: This script only affects the 'tenant-company-logos' bucket
-- It will NOT modify or delete any existing buckets or their policies

-- 1. Create the tenant-company-logos storage bucket (ignore if exists)
-- This is safe - it only creates if the bucket doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tenant-company-logos',
  'tenant-company-logos',
  true,
  2097152, -- 2MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Drop existing policies ONLY for tenant-company-logos bucket (if they exist)
-- These policy names are unique and scoped to this bucket only
-- Safe to run - won't affect other buckets' policies
DROP POLICY IF EXISTS "Enable upload for tenant company logos" ON storage.objects;
DROP POLICY IF EXISTS "Enable read access for tenant company logos" ON storage.objects;
DROP POLICY IF EXISTS "Enable update for tenant company logos" ON storage.objects;
DROP POLICY IF EXISTS "Enable delete for tenant company logos" ON storage.objects;

-- 3. Create RLS policy for authenticated users to upload
CREATE POLICY "Enable upload for tenant company logos" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'tenant-company-logos');

-- 4. Create RLS policy for public read access (needed for PDF generation)
CREATE POLICY "Enable read access for tenant company logos" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'tenant-company-logos');

-- 5. Create RLS policy for authenticated users to update
CREATE POLICY "Enable update for tenant company logos" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'tenant-company-logos');

-- 6. Create RLS policy for authenticated users to delete
CREATE POLICY "Enable delete for tenant company logos" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'tenant-company-logos');

-- 7. Verify the bucket was created
SELECT * FROM storage.buckets WHERE id = 'tenant-company-logos';

