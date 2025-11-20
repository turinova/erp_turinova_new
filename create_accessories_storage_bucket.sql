-- Setup Supabase Storage for Accessories Images
-- Run this in Supabase SQL Editor

-- 1. Create the accessories storage bucket (ignore if exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'accessories',
  'accessories',
  true,
  2097152, -- 2MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable upload for accessories" ON storage.objects;
DROP POLICY IF EXISTS "Enable read access for accessories" ON storage.objects;
DROP POLICY IF EXISTS "Enable update for accessories" ON storage.objects;
DROP POLICY IF EXISTS "Enable delete for accessories" ON storage.objects;

-- 3. Create RLS policy for authenticated users to upload
CREATE POLICY "Enable upload for accessories" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'accessories');

-- 4. Create RLS policy for authenticated users to view images
CREATE POLICY "Enable read access for accessories" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'accessories');

-- 5. Create RLS policy for authenticated users to update images
CREATE POLICY "Enable update for accessories" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'accessories');

-- 6. Create RLS policy for authenticated users to delete images
CREATE POLICY "Enable delete for accessories" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'accessories');

-- 7. Verify the bucket was created
SELECT * FROM storage.buckets WHERE id = 'accessories';

