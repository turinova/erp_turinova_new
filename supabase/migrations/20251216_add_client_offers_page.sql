-- Add client-offers page to pages table for permission system
INSERT INTO public.pages (path, name, description, category, is_active)
VALUES (
  '/client-offers',
  'Ügyfél ajánlatok',
  'Ügyfél ajánlatok kezelése',
  'sales',
  true
)
ON CONFLICT (path) DO NOTHING;

