-- =============================================================================
-- SAMPLE / REFERENCE — invoices (manual run, optional)
-- =============================================================================
-- After: migrations/20260325_create_invoices_table.sql
--        migrations/20250218_create_webshop_connections.sql
--        orders + order_items with real IDs
--
-- Do NOT insert fake Számlázz invoice rows in production; use only for local QA
-- if you need to test UI before calling the real API.
--
-- Example (commented): link a row to an existing order UUID and connection UUID.
-- =============================================================================
/*
INSERT INTO public.invoices (
  internal_number,
  provider,
  provider_invoice_number,
  provider_invoice_id,
  invoice_type,
  related_order_type,
  related_order_id,
  related_order_number,
  customer_name,
  payment_due_date,
  fulfillment_date,
  gross_total,
  payment_status,
  connection_id
) VALUES (
  'INV-2026-000001',
  'szamlazz_hu',
  'TEST-2026-1',
  'TEST-2026-1',
  'szamla',
  'order',
  'YOUR_ORDER_UUID'::uuid,
  'ORD-2026-...',
  'Teszt Vevő Kft.',
  CURRENT_DATE,
  CURRENT_DATE,
  10000.00,
  'fizetve',
  'YOUR_SZAMLAZZ_CONNECTION_UUID'::uuid
);
*/
