-- Add Munkalap ajánlatok (worktop-quotes) page to pages table for permission system
INSERT INTO public.pages (path, name, description, category, is_active)
VALUES (
  '/worktop-quotes',
  'Munkalap ajánlatok',
  'Munkalap ajánlatok kezelése és megtekintése',
  'Lapszabászat',
  true
)
ON CONFLICT (path) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active;
