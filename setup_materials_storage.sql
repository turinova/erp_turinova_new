-- Setup Supabase Storage for Materials Images
-- Run this in Supabase SQL Editor

-- 1. Create the materials storage bucket (ignore if exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'materials',
  'materials',
  true,
  2097152, -- 2MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable upload for authenticated users" ON storage.objects;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON storage.objects;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON storage.objects;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON storage.objects;

-- 3. Create RLS policy for authenticated users to upload
CREATE POLICY "Enable upload for authenticated users" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'materials');

-- 4. Create RLS policy for authenticated users to view images
CREATE POLICY "Enable read access for authenticated users" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'materials');

-- 5. Create RLS policy for authenticated users to update images
CREATE POLICY "Enable update for authenticated users" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'materials');

-- 6. Create RLS policy for authenticated users to delete images
CREATE POLICY "Enable delete for authenticated users" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'materials');

-- 7. Verify the bucket was created
SELECT * FROM storage.buckets WHERE id = 'materials';
