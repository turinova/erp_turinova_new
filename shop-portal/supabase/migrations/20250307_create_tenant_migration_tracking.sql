-- Tenant Migration Tracking System
-- Run this in the ADMIN DATABASE
-- Tracks which migrations have been applied to each tenant

-- 1. Create tenant_migrations table
CREATE TABLE IF NOT EXISTS public.tenant_migrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  migration_name VARCHAR(255) NOT NULL, -- e.g., '20250306_create_competitor_content_cache'
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  applied_by UUID REFERENCES public.admin_users(id),
  notes TEXT, -- Optional notes about the migration
  UNIQUE(tenant_id, migration_name)
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tenant_migrations_tenant_id 
ON public.tenant_migrations(tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_migrations_migration_name 
ON public.tenant_migrations(migration_name);

CREATE INDEX IF NOT EXISTS idx_tenant_migrations_applied_at 
ON public.tenant_migrations(applied_at DESC);

-- 3. Enable RLS
ALTER TABLE public.tenant_migrations ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Service role can manage all migrations
DROP POLICY IF EXISTS "Service role can manage tenant migrations" ON public.tenant_migrations;
CREATE POLICY "Service role can manage tenant migrations" ON public.tenant_migrations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated admin users can view migrations
DROP POLICY IF EXISTS "Admin users can view tenant migrations" ON public.tenant_migrations;
CREATE POLICY "Admin users can view tenant migrations" ON public.tenant_migrations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.id = auth.uid()
    )
  );

-- 5. Function to get pending migrations for a tenant
CREATE OR REPLACE FUNCTION public.get_tenant_pending_migrations(tenant_uuid UUID)
RETURNS TABLE (
  migration_name VARCHAR(255),
  applied BOOLEAN,
  applied_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  WITH all_migrations AS (
    -- List of all known migrations (you'll need to update this when adding new migrations)
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
      '20250414_add_pick_batches_page_to_permissions'
      -- Add new migrations here as you create them
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

-- 6. Function to mark migrations as applied (for new tenants using template)
CREATE OR REPLACE FUNCTION public.mark_tenant_migrations_applied(
  tenant_uuid UUID,
  migration_names TEXT[],
  applied_by_uuid UUID DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  migration_name TEXT;
  inserted_count INTEGER := 0;
BEGIN
  FOREACH migration_name IN ARRAY migration_names
  LOOP
    INSERT INTO public.tenant_migrations (tenant_id, migration_name, applied_by)
    VALUES (tenant_uuid, migration_name, applied_by_uuid)
    ON CONFLICT (tenant_id, migration_name) DO NOTHING;
    
    IF FOUND THEN
      inserted_count := inserted_count + 1;
    END IF;
  END LOOP;
  
  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Grant permissions
GRANT SELECT ON public.tenant_migrations TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_pending_migrations(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_tenant_migrations_applied(UUID, TEXT[], UUID) TO authenticated;

-- Comments
COMMENT ON TABLE public.tenant_migrations IS 'Tracks which database migrations have been applied to each tenant';
COMMENT ON COLUMN public.tenant_migrations.migration_name IS 'Name of the migration file (e.g., 20250306_create_competitor_content_cache)';
COMMENT ON FUNCTION public.get_tenant_pending_migrations IS 'Returns list of all migrations and whether they are applied for a tenant';
COMMENT ON FUNCTION public.mark_tenant_migrations_applied IS 'Marks multiple migrations as applied for a tenant (useful when using template)';
