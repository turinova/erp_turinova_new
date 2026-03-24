-- =============================================================================
-- SAMPLE / REFERENCE — fee definitions + order fees (manual run, optional)
-- =============================================================================
-- After:
--   migrations/20260329_create_fees_tables.sql
--   migrations/20260329_add_fees_page_to_permissions.sql
-- and after you have a real order id in this tenant DB.
--
-- Replace YOUR_ORDER_UUID with a valid order id.
-- =============================================================================

/*
-- Optional: add an extra catalog fee template
INSERT INTO public.fee_definitions (
  code, name, type, default_vat_rate, default_gross, price_mode, is_active, sort_order
) VALUES (
  'HANDLING', 'Kezelési díj', 'SERVICE', 27, 990, 'manual_only', true, 60
)
ON CONFLICT (tenant_id, code) WHERE deleted_at IS NULL DO NOTHING;

-- Example: attach fee rows to an existing order
INSERT INTO public.order_fees (
  order_id, fee_definition_id, source, type, name, quantity,
  unit_net, unit_gross, vat_rate, line_net, line_gross, currency_code, sort_order
)
SELECT
  'YOUR_ORDER_UUID'::uuid,
  fd.id,
  'manual',
  fd.type,
  fd.name,
  1,
  ROUND(1490 / 1.27, 2),
  1490,
  27,
  ROUND(1490 / 1.27, 2),
  1490,
  'HUF',
  10
FROM public.fee_definitions fd
WHERE fd.code = 'SHIPPING'
LIMIT 1;
*/

