-- Simple Permission System Setup
-- This script creates a clean, fast permission system

-- 1. Drop existing user_permissions table if it exists
DROP TABLE IF EXISTS public.user_permissions CASCADE;

-- 2. Create new simple user_permissions table
CREATE TABLE public.user_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  page_id uuid NOT NULL,
  can_access boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_permissions_pkey PRIMARY KEY (id),
  CONSTRAINT user_permissions_user_page_unique UNIQUE (user_id, page_id),
  CONSTRAINT user_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT user_permissions_page_id_fkey FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
);

-- 2.1. Drop existing function first, then create with correct type
DROP FUNCTION IF EXISTS public.get_user_permissions(uuid);

-- 2.2. Create function to get user permissions (FIXED TYPE MISMATCH)
CREATE FUNCTION public.get_user_permissions(user_uuid uuid)
RETURNS TABLE(page_path varchar(255), can_access boolean) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.path as page_path,
    COALESCE(up.can_access, true) as can_access
  FROM public.pages p
  LEFT JOIN public.user_permissions up ON p.id = up.page_id AND up.user_id = user_uuid
  WHERE p.is_active = true
  ORDER BY p.category, p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create performance indexes
CREATE INDEX idx_user_permissions_user_id ON public.user_permissions USING btree (user_id);
CREATE INDEX idx_user_permissions_page_id ON public.user_permissions USING btree (page_id);
CREATE INDEX idx_user_permissions_user_access ON public.user_permissions USING btree (user_id, can_access);

-- 4. Clear existing pages and populate with all current routes
DELETE FROM public.pages;

INSERT INTO public.pages (path, name, description, category, is_active) VALUES
-- Main navigation pages
('/home', 'Főoldal', 'Dashboard főoldal', 'main', true),
('/search', 'Kereső', 'Termékek keresése', 'main', true),
('/opti', 'Opti', 'Optimalizálás', 'main', true),
('/shoporder', 'Rendelést felvétel', 'Új rendelés felvétele', 'main', true),
('/scanner', 'Scanner', 'QR kód scanner', 'main', true),

-- Lapszabászat submenu
('/orders', 'Megrendelések', 'Megrendelések listája', 'lapszabaszat', true),
('/quotes', 'Ajánlatok', 'Ajánlatok listája', 'lapszabaszat', true),

-- Beszerzés submenu  
('/customer-orders', 'Ügyfél rendelések', 'Ügyfél rendelések listája', 'beszerzes', true),
('/supplier-orders', 'Beszállítói rendelések', 'Beszállítói rendelések listája', 'beszerzes', true),

-- Törzsadatok submenu
('/materials', 'Anyagok', 'Anyagok kezelése', 'torzsadatok', true),
('/linear-materials', 'Lineáris anyagok', 'Lineáris anyagok kezelése', 'torzsadatok', true),
('/accessories', 'Kiegészítők', 'Kiegészítők kezelése', 'torzsadatok', true),
('/edge', 'Szegélyek', 'Szegélyek kezelése', 'torzsadatok', true),
('/partners', 'Partnerek', 'Partnerek kezelése', 'torzsadatok', true),
('/customers', 'Ügyfelek', 'Ügyfelek kezelése', 'torzsadatok', true),
('/workers', 'Dolgozók', 'Dolgozók kezelése', 'torzsadatok', true),
('/vat', 'ÁFA', 'ÁFA kulcsok kezelése', 'torzsadatok', true),
('/currencies', 'Pénznemek', 'Pénznemek kezelése', 'torzsadatok', true),
('/units', 'Mértékegységek', 'Mértékegységek kezelése', 'torzsadatok', true),
('/feetypes', 'Díjtípusok', 'Díjtípusok kezelése', 'torzsadatok', true),

-- Beállítások submenu
('/company', 'Cégadatok', 'Cégadatok kezelése', 'beallitasok', true),
('/opti-settings', 'Opti beállítások', 'Optimalizálás beállításai', 'beallitasok', true),
('/users', 'Felhasználók', 'Felhasználók és jogosultságok kezelése', 'beallitasok', true)

ON CONFLICT (path) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- 5. Grant default access to all pages for all existing users
-- This ensures new users have access to everything by default
INSERT INTO public.user_permissions (user_id, page_id, can_access)
SELECT 
  u.id as user_id,
  p.id as page_id,
  true as can_access
FROM auth.users u
CROSS JOIN public.pages p
WHERE p.is_active = true
ON CONFLICT (user_id, page_id) DO NOTHING;

-- 6. Create function to automatically grant access to new users
CREATE OR REPLACE FUNCTION grant_default_permissions_to_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_permissions (user_id, page_id, can_access)
  SELECT 
    NEW.id,
    p.id,
    true
  FROM public.pages p
  WHERE p.is_active = true;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Create trigger to automatically grant permissions to new users
DROP TRIGGER IF EXISTS trigger_grant_default_permissions ON auth.users;
CREATE TRIGGER trigger_grant_default_permissions
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION grant_default_permissions_to_new_user();

-- 8. Create function to get user permissions (for caching)
CREATE OR REPLACE FUNCTION get_user_permissions(user_uuid uuid)
RETURNS TABLE(page_path text, can_access boolean) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.path,
    up.can_access
  FROM public.pages p
  LEFT JOIN public.user_permissions up ON p.id = up.page_id AND up.user_id = user_uuid
  WHERE p.is_active = true
  ORDER BY p.path;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permissions TO authenticated;
GRANT SELECT ON public.pages TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_permissions(uuid) TO authenticated;

-- 10. Create RLS policies for security
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;

-- Users can only see their own permissions
CREATE POLICY "Users can view their own permissions" ON public.user_permissions
  FOR SELECT USING (auth.uid() = user_id);

-- Users can update their own permissions (for admin interface)
CREATE POLICY "Users can update their own permissions" ON public.user_permissions
  FOR UPDATE USING (auth.uid() = user_id);

-- All authenticated users can view pages
CREATE POLICY "Authenticated users can view pages" ON public.pages
  FOR SELECT USING (auth.role() = 'authenticated');

COMMENT ON TABLE public.user_permissions IS 'Simple permission system - users can access pages or not';
COMMENT ON FUNCTION get_user_permissions(uuid) IS 'Get all permissions for a user - used for session caching';
