-- =============================================================================
-- SAMPLE / NEW TENANT DATABASE — buffer auto díjbekérő (manual run after migration)
-- =============================================================================
-- Prerequisites (tenant DB):
--   supabase/migrations/20260326_buffer_auto_proforma.sql
-- Admin DB (optional, migration tracking):
--   supabase/migrations/20260326_tenant_migration_list_buffer_auto_proforma.sql
--
-- After columns exist, you can optionally enable defaults for testing:
-- =============================================================================

-- Example: turn on auto proforma for one ERP payment method (adjust name)
/*
UPDATE public.payment_methods
SET auto_proforma_on_import = true
WHERE deleted_at IS NULL
  AND name ILIKE '%Utánvét%'
LIMIT 1;
*/

-- Example: enable master switch on Számlázz connection (adjust name)
/*
UPDATE public.webshop_connections
SET buffer_auto_proforma_enabled = true
WHERE deleted_at IS NULL
  AND connection_type = 'szamlazz'
  AND name ILIKE '%Számlázz%'
LIMIT 1;
*/
