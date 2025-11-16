-- Add /purchase-order page to the permission system
INSERT INTO public.pages (path, name, description, category, is_active)
VALUES ('/purchase-order', 'Beszállítói rendelése', 'Beszállítói rendelések kezelése', 'Beszerzés', true)
ON CONFLICT (path) DO NOTHING;

-- Verify
SELECT * FROM public.pages WHERE path = '/purchase-order';

