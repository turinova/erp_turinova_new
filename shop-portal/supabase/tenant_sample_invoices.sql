-- =============================================================================
-- SAMPLE / REFERENCE — invoices (manual run, optional)
-- =============================================================================
-- After: migrations/20260325_create_invoices_table.sql
--        migrations/20250218_create_webshop_connections.sql
--        migrations/20260328_add_outgoing_invoices_page_to_permissions.sql (menu + /finance/outgoing-invoices)
--        orders + order_items with real IDs (for related_order_id)
--
-- Use this to populate **Kimenő számlák** (`/finance/outgoing-invoices`) in dev/demo before live Számlázz calls.
-- Do NOT insert fake rows in production.
--
-- Replace YOUR_ORDER_UUID and YOUR_SZAMLAZZ_CONNECTION_UUID with real UUIDs from your tenant DB.
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
  pdf_url,
  connection_id
) VALUES (
  'INV-2026-000001',
  'szamlazz_hu',
  'TEST-2026-1',
  'TEST-2026-1',
  'szamla',
  'order',
  'YOUR_ORDER_UUID'::uuid,
  'ORD-2026-001',
  'Teszt Vevő Kft.',
  CURRENT_DATE + 14,
  CURRENT_DATE,
  125900.00,
  'fizetve',
  'https://example.com/sample-invoice.pdf',
  'YOUR_SZAMLAZZ_CONNECTION_UUID'::uuid
);

INSERT INTO public.invoices (
  internal_number,
  provider,
  provider_invoice_number,
  invoice_type,
  related_order_type,
  related_order_id,
  related_order_number,
  customer_name,
  payment_due_date,
  gross_total,
  payment_status,
  connection_id
) VALUES (
  'INV-2026-000002',
  'szamlazz_hu',
  'TEST-DB-2',
  'dijbekero',
  'order',
  'YOUR_ORDER_UUID'::uuid,
  'ORD-2026-002',
  'Minta Webshop Kft.',
  CURRENT_DATE + 7,
  45990.00,
  'pending',
  'YOUR_SZAMLAZZ_CONNECTION_UUID'::uuid
);
*/
