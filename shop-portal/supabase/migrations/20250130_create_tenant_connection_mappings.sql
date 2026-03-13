-- =============================================================================
-- Tenant Connection Mappings (Admin Database)
-- =============================================================================
-- This migration creates a mapping table in the ADMIN DATABASE to link
-- webshop_connections (from tenant databases) to tenants.
-- 
-- IMPORTANT: This migration MUST be run in the ADMIN DATABASE, not in tenant databases!
-- 
-- Purpose:
-- - Enable webhook handler to determine which tenant database a connection belongs to
-- - Map connection_id (UUID) to tenant_id
-- - Store api_url for quick lookup from webhook payload
-- =============================================================================

-- Create tenant_connection_mappings table
CREATE TABLE IF NOT EXISTS public.tenant_connection_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL, -- UUID from tenant database's webshop_connections table
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Connection identifiers for webhook matching
  api_url TEXT NOT NULL, -- e.g., "http://vasalatmester.api.myshoprenter.hu"
  store_name TEXT, -- ShopRenter store name (optional, for fallback matching)
  connection_name TEXT, -- Connection name from tenant database
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Constraints
  UNIQUE(connection_id), -- Each connection_id maps to exactly one tenant
  UNIQUE(tenant_id, api_url) -- Each tenant can have only one connection per api_url
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_tenant_connection_mappings_connection_id 
  ON public.tenant_connection_mappings(connection_id);
  
CREATE INDEX IF NOT EXISTS idx_tenant_connection_mappings_tenant_id 
  ON public.tenant_connection_mappings(tenant_id);
  
CREATE INDEX IF NOT EXISTS idx_tenant_connection_mappings_api_url 
  ON public.tenant_connection_mappings(api_url);
  
CREATE INDEX IF NOT EXISTS idx_tenant_connection_mappings_store_name 
  ON public.tenant_connection_mappings(store_name) 
  WHERE store_name IS NOT NULL;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_tenant_connection_mappings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_tenant_connection_mappings_updated_at ON public.tenant_connection_mappings;
CREATE TRIGGER update_tenant_connection_mappings_updated_at
  BEFORE UPDATE ON public.tenant_connection_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_connection_mappings_updated_at();

-- Enable RLS
ALTER TABLE public.tenant_connection_mappings ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role can manage mappings
DROP POLICY IF EXISTS "Service role can manage tenant connection mappings" ON public.tenant_connection_mappings;
CREATE POLICY "Service role can manage tenant connection mappings"
  ON public.tenant_connection_mappings FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Grant permissions
GRANT ALL ON public.tenant_connection_mappings TO service_role;

-- Comments
COMMENT ON TABLE public.tenant_connection_mappings IS 'Maps webshop connections to tenants for webhook routing';
COMMENT ON COLUMN public.tenant_connection_mappings.connection_id IS 'UUID from tenant database webshop_connections table';
COMMENT ON COLUMN public.tenant_connection_mappings.api_url IS 'ShopRenter API URL for webhook matching (e.g., http://shopname.api.myshoprenter.hu)';
COMMENT ON COLUMN public.tenant_connection_mappings.store_name IS 'ShopRenter store name for fallback matching';
