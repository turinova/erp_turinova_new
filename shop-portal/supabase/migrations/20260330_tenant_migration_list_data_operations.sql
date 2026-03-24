-- Append data operations permissions migration to admin tenant migration list.
-- Run on ADMIN DATABASE.

CREATE OR REPLACE FUNCTION public.get_tenant_pending_migrations(tenant_uuid UUID)
RETURNS TABLE (
  migration_name VARCHAR(255),
  applied BOOLEAN,
  applied_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  WITH all_migrations AS (
    SELECT unnest(ARRAY[
      '20250218_create_permission_system',
      '20250218_create_webshop_connections',
      '20250218_fix_rls_policies',
      '20250219_create_products_tables',
      '20250125_add_vat_support',
      '20250126_add_parameters_and_product_tags',
      '20250127_add_subscription_system',
      '20250128_add_unified_credit_system',
      '20250220_create_competitors_system',
      '20250220_add_pricing_fields',
      '20250221_create_ai_description_system',
      '20250222_create_search_console_tables',
      '20250228_create_product_images_table',
      '20250301_create_product_quality_scores',
      '20250304_create_categories_tables',
      '20250306_create_competitor_content_cache',
      '20250329_orders_customer_company',
      '20250330_customer_addresses_entity_id_nullable',
      '20250401_order_items_discount',
      '20250402_orders_status_workflow',
      '20250413_add_replenishment_page_to_permissions',
      '20250414_create_pick_batches',
      '20250414_add_pick_batches_page_to_permissions',
      '20250415_orders_shipped_at',
      '20250415_add_packing_page_to_permissions',
      '20250416_orders_status_awaiting_carrier',
      '20250416_shipping_methods_carrier_credentials',
      '20250417_add_dispatch_page_to_permissions',
      '20250418_create_email_management_tables',
      '20250418_add_email_settings_page_permissions',
      '20250419_email_outbound_channel_settings',
      '20250420_suppliers_email_po_intro_html',
      '20250421_order_status_email_notifications',
      '20250421_add_order_status_notifications_page_permissions',
      '20260320_payment_methods_import_payment_policy',
      '20260322_stock_movements_reversed_movement_id',
      '20260324_create_sync_jobs',
      '20260325_create_invoices_table',
      '20260326_buffer_auto_proforma',
      '20260327_buffer_auto_proforma_due_days',
      '20260328_add_outgoing_invoices_page_to_permissions',
      '20260329_create_fees_tables',
      '20260329_add_fees_page_to_permissions',
      '20260330_add_data_operations_page_to_permissions',
      '20260330_suppliers_short_name_required_unique_code'
    ]) AS migration_name
  )
  SELECT
    am.migration_name,
    COALESCE(tm.migration_name IS NOT NULL, false) AS applied,
    tm.applied_at
  FROM all_migrations am
  LEFT JOIN public.tenant_migrations tm
    ON tm.tenant_id = tenant_uuid
    AND tm.migration_name = am.migration_name
  ORDER BY am.migration_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
