-- Create Supabase Storage Bucket for Product Source Materials
-- Run this SQL manually in your Supabase SQL Editor

-- Create storage bucket for product source PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-sources', 
  'product-sources', 
  false, -- Private bucket
  10485760, -- 10 MB limit
  ARRAY['application/pdf', 'text/plain'] -- Only PDFs and text files
)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: Authenticated users can upload source materials
DROP POLICY IF EXISTS "Authenticated users can upload source materials" ON storage.objects;
CREATE POLICY "Authenticated users can upload source materials"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-sources' AND
  (storage.foldername(name))[1] = 'sources'
);

-- Storage policy: Authenticated users can read their own source materials
DROP POLICY IF EXISTS "Authenticated users can read source materials" ON storage.objects;
CREATE POLICY "Authenticated users can read source materials"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'product-sources');

-- Storage policy: Authenticated users can delete source materials
DROP POLICY IF EXISTS "Authenticated users can delete source materials" ON storage.objects;
CREATE POLICY "Authenticated users can delete source materials"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-sources');
