-- Add all missing pages to the permission system
-- Run this in Supabase SQL Editor

-- Insert all missing pages
INSERT INTO pages (path, name, description, category) VALUES
  -- Search & Tools
  ('/search', 'Kereső', 'Keresés a rendszerben', 'Általános'),
  ('/scanner', 'Scanner', 'Vonalkód beolvasó', 'Eszközök'),
  ('/shoporder', 'Rendelés felvétel', 'Bolt rendelés felvétele', 'Rendelések'),
  
  -- Lapszabászat (Cutting)
  ('/orders', 'Megrendelések', 'Lapszabászat megrendelések', 'Lapszabászat'),
  ('/quotes', 'Ajánlatok', 'Lapszabászat ajánlatok', 'Lapszabászat'),
  
  -- Beszerzés (Procurement)
  ('/customer-orders', 'Ügyfél rendelések', 'Vevői rendelések kezelése', 'Beszerzés'),
  ('/supplier-orders', 'Beszállítói rendelések', 'Beszállítói rendelések kezelése', 'Beszerzés'),
  
  -- Törzsadatok (Master Data)
  ('/partners', 'Beszállítók', 'Beszállítók kezelése', 'Törzsadatok'),
  ('/brands', 'Gyártók', 'Gyártók kezelése', 'Törzsadatok'),
  ('/currencies', 'Pénznem', 'Pénznemek kezelése', 'Törzsadatok'),
  ('/units', 'Egységek', 'Mértékegységek kezelése', 'Törzsadatok'),
  ('/materials', 'Táblás anyagok', 'Táblás anyagok kezelése', 'Törzsadatok'),
  ('/linear-materials', 'Szálas anyagok', 'Szálas anyagok kezelése', 'Törzsadatok'),
  ('/edge', 'Élzárók', 'Élzárók kezelése', 'Törzsadatok'),
  ('/media', 'Media', 'Média kezelése', 'Törzsadatok'),
  ('/feetypes', 'Díj típusok', 'Díjtípusok kezelése', 'Törzsadatok'),
  ('/machines', 'Gépek', 'Gépek kezelése', 'Törzsadatok'),
  ('/accessories', 'Termékek', 'Termékek kezelése', 'Törzsadatok'),
  ('/workers', 'Dolgozók', 'Dolgozók kezelése', 'Törzsadatok'),
  
  -- Settings
  ('/opti-settings', 'Opti beállítások', 'Optimalizáló beállítások', 'Beállítások')
ON CONFLICT (path) DO NOTHING;

-- Optional: Grant access to all new pages for admin user
-- Replace 'admin@turinova.hu' with your admin email
DO $$
DECLARE
  admin_user_id UUID;
BEGIN
  -- Get admin user ID
  SELECT id INTO admin_user_id 
  FROM auth.users 
  WHERE email = 'admin@turinova.hu' 
  LIMIT 1;
  
  IF admin_user_id IS NOT NULL THEN
    -- Grant admin access to all pages
    INSERT INTO user_permissions (user_id, page_id, can_view, can_edit, can_delete)
    SELECT 
      admin_user_id,
      p.id,
      true,
      false,
      false
    FROM pages p
    WHERE NOT EXISTS (
      SELECT 1 FROM user_permissions up 
      WHERE up.user_id = admin_user_id AND up.page_id = p.id
    );
    
    RAISE NOTICE 'Granted permissions to admin user';
  ELSE
    RAISE NOTICE 'Admin user not found';
  END IF;
END $$;

-- Verify all pages
SELECT 
  category,
  COUNT(*) as page_count,
  STRING_AGG(path, ', ' ORDER BY path) as paths
FROM pages
GROUP BY category
ORDER BY category;

-- Show total count
SELECT COUNT(*) as total_pages FROM pages;

