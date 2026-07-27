-- =====================================================
-- Portal customer workshop logo (ügyfélajánlat PDF)
-- Futtasd manuálisan a portal Supabase-en.
-- =====================================================

BEGIN;

ALTER TABLE public.portal_customers
  ADD COLUMN IF NOT EXISTS workshop_logo_data_url text;

COMMENT ON COLUMN public.portal_customers.workshop_logo_data_url IS
  'Asztalos céglogo data URL (data:image/png|jpeg|webp;base64,...) az ügyfélajánlat PDF-hez. Max ~700k karakter.';

COMMIT;
