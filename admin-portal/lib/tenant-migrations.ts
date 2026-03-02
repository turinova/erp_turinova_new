/**
 * Tenant Migration Management
 * Helper functions for managing tenant database migrations
 */

import { createAdminClient } from './supabase-server'

/**
 * List of all tenant database migrations (in chronological order)
 * Update this when adding new migrations
 */
export const TENANT_MIGRATIONS = [
  '20250218_create_permission_system',
  '20250218_create_webshop_connections',
  '20250218_fix_rls_policies',
  '20250219_create_products_tables',
  '20250125_add_vat_page_to_permissions',
  '20250125_add_vat_support',
  '20250126_add_parameters_and_product_tags',
  '20250127_add_subscription_page_to_permissions',
  '20250127_add_subscription_system',
  '20250128_add_unified_credit_system',
  '20250130_add_products_search_indexes',
  '20250220_add_competitor_subpages',
  '20250220_add_competitor_tracking_flag',
  '20250220_add_model_number',
  '20250220_add_price_gross_column',
  '20250220_add_pricing_fields',
  '20250220_add_products_performance_indexes',
  '20250220_cleanup_sitemap_tables',
  '20250220_create_competitors_system',
  '20250221_create_ai_description_system',
  '20250221_create_storage_bucket',
  '20250222_add_generation_instructions',
  '20250222_add_product_urls',
  '20250222_add_search_console_config',
  '20250222_create_search_console_tables',
  '20250224_add_url_alias_id',
  '20250225_add_parent_product_support',
  '20250226_fix_parent_canonical_urls',
  '20250226_fix_self_referencing_parent_product_id',
  '20250227_remove_seo_features',
  '20250228_create_product_images_table',
  '20250301_add_quality_scores_insert_update_policies',
  '20250301_create_product_quality_scores',
  '20250302_enhance_indexing_status',
  '20250303_add_brand_field',
  '20250303_allow_anon_read_products_for_api',
  '20250304_create_categories_tables',
  '20250305_update_categories_rls_to_match_products',
  '20250306_create_competitor_content_cache'
] as const

/**
 * Get pending migrations for a tenant
 */
export async function getTenantPendingMigrations(tenantId: string) {
  const supabase = createAdminClient()
  
  const { data, error } = await supabase
    .rpc('get_tenant_pending_migrations', { tenant_uuid: tenantId })
  
  if (error) {
    console.error('[Admin] Error fetching pending migrations:', error)
    throw error
  }
  
  return data || []
}

/**
 * Mark migrations as applied for a tenant
 * Useful when a tenant is created using the template
 */
export async function markTenantMigrationsApplied(
  tenantId: string,
  migrationNames: string[],
  appliedBy?: string
) {
  const supabase = createAdminClient()
  
  const { data, error } = await supabase
    .rpc('mark_tenant_migrations_applied', {
      tenant_uuid: tenantId,
      migration_names: migrationNames,
      applied_by_uuid: appliedBy || null
    })
  
  if (error) {
    console.error('[Admin] Error marking migrations as applied:', error)
    throw error
  }
  
  return data
}

/**
 * Mark all current migrations as applied (for new tenants using template)
 */
export async function markAllMigrationsApplied(tenantId: string, appliedBy?: string) {
  return markTenantMigrationsApplied(tenantId, [...TENANT_MIGRATIONS], appliedBy)
}
