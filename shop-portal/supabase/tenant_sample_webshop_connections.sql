-- =============================================================================
-- SAMPLE / NEW TENANT DATABASE — webshop_connections (optional seed, manual run)
-- =============================================================================
-- Multi-tenant SaaS: each tenant DB has its own `webshop_connections` rows.
-- No extra migration is required for Számlázz: `connection_type` is VARCHAR and
-- accepts `szamlazz` (Agent key stored in `password`, `username` = '').
--
-- Prerequisites:
--   Run migrations/20250218_create_webshop_connections.sql (and later connection
--   columns such as search_console_* from 20250222 if you use Search Console).
--   For buffer_auto_proforma_*: migrations/20260326_buffer_auto_proforma.sql,
--   20260327_buffer_auto_proforma_due_days.sql
--
-- Replace placeholders before running in a real tenant:
--   - YOUR_SHOPRENTER_* : real ShopRenter OAuth / API values
--   - YOUR_SZAMLAZZ_AGENT_KEY : Számla Agent kulcs from Számlázz.hu
--
-- To verify Számlázz test flow from the app: Kapcsolatok → Számlázz → Teszt
-- (calls taxpayer query; read-only, same Agent protocol as main-app invoicing).
-- =============================================================================

-- Example: ShopRenter (comment out if you only need Számlázz seed)
/*
INSERT INTO public.webshop_connections (
  name,
  connection_type,
  api_url,
  username,
  password,
  is_active
) VALUES (
  'Demo ShopRenter',
  'shoprenter',
  'https://YOURSHOP.api2.myshoprenter.hu',
  'YOUR_SHOPRENTER_CLIENT_ID',
  'YOUR_SHOPRENTER_CLIENT_SECRET',
  true
);
*/

-- Example: Számlázz.hu (Agent URL must end with / — app normalizes on save)
-- Idempotent: skips if a row with same name + type already exists.
INSERT INTO public.webshop_connections (
  name,
  connection_type,
  api_url,
  username,
  password,
  is_active,
  buffer_auto_proforma_enabled,
  buffer_auto_proforma_due_days
)
SELECT
  'Számlázz (demo)',
  'szamlazz',
  'https://www.szamlazz.hu/szamla/',
  '',
  'YOUR_SZAMLAZZ_AGENT_KEY',
  true,
  false,
  8
WHERE NOT EXISTS (
  SELECT 1 FROM public.webshop_connections w
  WHERE w.deleted_at IS NULL
    AND w.name = 'Számlázz (demo)'
    AND w.connection_type = 'szamlazz'
);
