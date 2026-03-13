-- Create customer_entity_platform_mappings table
-- This table stores platform-specific IDs for customer entities (ShopRenter, Unas, Shopify, etc.)
-- Used for syncing customers between ERP and webshops

CREATE TABLE IF NOT EXISTS public.customer_entity_platform_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_entity_id UUID NOT NULL REFERENCES customer_entities(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES webshop_connections(id) ON DELETE CASCADE,
  
  -- Platform-specific IDs
  platform_customer_id TEXT NOT NULL, -- ShopRenter ID, Unas ID, Shopify ID, etc.
  platform_inner_id TEXT, -- Platform's internal ID (if different)
  platform_username TEXT, -- Felhasználónév (ShopRenter ID vagy username)
  
  -- Sync tracking
  last_synced_at TIMESTAMPTZ,
  last_synced_from_platform_at TIMESTAMPTZ,
  last_synced_to_platform_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraints
  UNIQUE(customer_entity_id, connection_id),
  UNIQUE(connection_id, platform_customer_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customer_platform_mappings_entity_id ON public.customer_entity_platform_mappings(customer_entity_id);
CREATE INDEX IF NOT EXISTS idx_customer_platform_mappings_connection_id ON public.customer_entity_platform_mappings(connection_id);
CREATE INDEX IF NOT EXISTS idx_customer_platform_mappings_platform_id ON public.customer_entity_platform_mappings(platform_customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_platform_mappings_synced_from ON public.customer_entity_platform_mappings(last_synced_from_platform_at) WHERE last_synced_from_platform_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_platform_mappings_synced_to ON public.customer_entity_platform_mappings(last_synced_to_platform_at) WHERE last_synced_to_platform_at IS NOT NULL;

-- Trigger for updated_at
CREATE TRIGGER update_customer_platform_mappings_updated_at
BEFORE UPDATE ON public.customer_entity_platform_mappings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.customer_entity_platform_mappings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Customer platform mappings are viewable by authenticated users" ON public.customer_entity_platform_mappings;
CREATE POLICY "Customer platform mappings are viewable by authenticated users" 
ON public.customer_entity_platform_mappings
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Customer platform mappings are manageable by authenticated users" ON public.customer_entity_platform_mappings;
CREATE POLICY "Customer platform mappings are manageable by authenticated users" 
ON public.customer_entity_platform_mappings
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_entity_platform_mappings TO authenticated;

-- Comments
COMMENT ON TABLE public.customer_entity_platform_mappings IS 'Platform-specific customer IDs for syncing between ERP and webshops (ShopRenter, Unas, Shopify, etc.)';
COMMENT ON COLUMN public.customer_entity_platform_mappings.platform_customer_id IS 'Platform-specific customer ID (base64 encoded for ShopRenter)';
COMMENT ON COLUMN public.customer_entity_platform_mappings.platform_username IS 'Platform username or identifier';
COMMENT ON COLUMN public.customer_entity_platform_mappings.last_synced_from_platform_at IS 'When customer was last synced FROM platform (pull)';
COMMENT ON COLUMN public.customer_entity_platform_mappings.last_synced_to_platform_at IS 'When customer was last synced TO platform (push)';

-- Create customer_address_platform_mappings table
CREATE TABLE IF NOT EXISTS public.customer_address_platform_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address_id UUID NOT NULL REFERENCES customer_addresses(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES webshop_connections(id) ON DELETE CASCADE,
  
  platform_address_id TEXT NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(address_id, connection_id),
  UNIQUE(connection_id, platform_address_id)
);

-- Indexes for address mappings
CREATE INDEX IF NOT EXISTS idx_customer_address_platform_mappings_address_id ON public.customer_address_platform_mappings(address_id);
CREATE INDEX IF NOT EXISTS idx_customer_address_platform_mappings_connection_id ON public.customer_address_platform_mappings(connection_id);
CREATE INDEX IF NOT EXISTS idx_customer_address_platform_mappings_platform_id ON public.customer_address_platform_mappings(platform_address_id);

-- Trigger for updated_at
CREATE TRIGGER update_customer_address_platform_mappings_updated_at
BEFORE UPDATE ON public.customer_address_platform_mappings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.customer_address_platform_mappings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Customer address platform mappings are viewable by authenticated users" ON public.customer_address_platform_mappings;
CREATE POLICY "Customer address platform mappings are viewable by authenticated users" 
ON public.customer_address_platform_mappings
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Customer address platform mappings are manageable by authenticated users" ON public.customer_address_platform_mappings;
CREATE POLICY "Customer address platform mappings are manageable by authenticated users" 
ON public.customer_address_platform_mappings
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_address_platform_mappings TO authenticated;

-- Comments
COMMENT ON TABLE public.customer_address_platform_mappings IS 'Platform-specific address IDs for syncing customer addresses between ERP and webshops';
