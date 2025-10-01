-- Create media_files table to track uploaded images with original filenames
-- This enables better export/import functionality and Media library management

CREATE TABLE IF NOT EXISTS media_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_filename TEXT NOT NULL,
  stored_filename TEXT NOT NULL UNIQUE,
  storage_path TEXT NOT NULL,
  full_url TEXT NOT NULL,
  size BIGINT NOT NULL DEFAULT 0,
  mimetype TEXT DEFAULT 'image/webp',
  uploaded_by UUID,  -- Removed FK constraint to users table (doesn't exist)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_media_files_original_filename ON media_files(original_filename);
CREATE INDEX IF NOT EXISTS idx_media_files_stored_filename ON media_files(stored_filename);
CREATE INDEX IF NOT EXISTS idx_media_files_uploaded_by ON media_files(uploaded_by);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_media_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER media_files_updated_at
  BEFORE UPDATE ON media_files
  FOR EACH ROW
  EXECUTE FUNCTION update_media_files_updated_at();

-- Add comments
COMMENT ON TABLE media_files IS 'Tracks all uploaded media files with original and stored filenames for better management';
COMMENT ON COLUMN media_files.original_filename IS 'Original filename when uploaded (e.g., H1379_ST36_Orleans.webp)';
COMMENT ON COLUMN media_files.stored_filename IS 'Filename as stored in Supabase (e.g., material-id-timestamp.webp)';
COMMENT ON COLUMN media_files.storage_path IS 'Full path in storage bucket (e.g., materials/stored_filename.webp)';
COMMENT ON COLUMN media_files.full_url IS 'Full public URL to access the image';
COMMENT ON COLUMN media_files.size IS 'File size in bytes';

-- Verify table creation
SELECT 
  table_name, 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'media_files'
ORDER BY ordinal_position;

