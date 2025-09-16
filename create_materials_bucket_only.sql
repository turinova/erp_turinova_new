-- Create materials storage bucket only
-- Run this in Supabase SQL Editor

-- Create the materials storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'materials',
  'materials',
  true,
  2097152, -- 2MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Verify the bucket was created
SELECT * FROM storage.buckets WHERE id = 'materials';
