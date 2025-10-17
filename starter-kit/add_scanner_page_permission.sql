-- Add Scanner page to the pages table for permission system
-- Date: 2025-01-28
-- Purpose: Register Scanner page in the permission system

-- Insert Scanner page (uses ON CONFLICT to avoid duplicates)
INSERT INTO public.pages (path, name, description, category, is_active)
VALUES (
  '/scanner',
  'Scanner',
  'Barcode scanner page for quick production assignments',
  'Eszközök',
  true
)
ON CONFLICT (path) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Verify the page was added
SELECT id, name, path, description, category, is_active
FROM public.pages 
WHERE path = '/scanner';

