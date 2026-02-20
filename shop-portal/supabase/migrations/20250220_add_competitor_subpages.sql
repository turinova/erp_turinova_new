-- Add competitor dashboard and links pages to permission system

INSERT INTO public.pages (path, name, description, category) VALUES
  ('/competitors/dashboard', 'Versenytárs Dashboard', 'Árelemzés dashboard és összefoglaló', 'SEO'),
  ('/competitors/links', 'Linkek kezelése', 'Versenytárs linkek tömeges kezelése', 'SEO')
ON CONFLICT (path) DO NOTHING;
