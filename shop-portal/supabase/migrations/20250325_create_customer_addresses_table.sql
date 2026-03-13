-- Create customer_addresses table
-- This table stores multiple addresses for customer entities (both persons and companies)

CREATE TABLE IF NOT EXISTS public.customer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_entity_id UUID NOT NULL REFERENCES customer_entities(id) ON DELETE CASCADE,
  
  -- Address type
  address_type VARCHAR(20) NOT NULL DEFAULT 'billing', 
  -- 'billing' (számlázási), 'shipping' (szállítási), 
  -- 'registered' (székhely - csak cégeknél), 'mailing' (levelezési - csak cégeknél)
  
  -- Personal/Company info
  firstname VARCHAR(255), -- For persons
  lastname VARCHAR(255),   -- For persons
  company VARCHAR(255),   -- For companies or if person wants company name on address
  
  -- Address details
  address1 VARCHAR(255) NOT NULL,
  address2 VARCHAR(255),
  postcode VARCHAR(20) NOT NULL,
  city VARCHAR(100) NOT NULL,
  country_code VARCHAR(3) DEFAULT 'HU', -- ISO country code
  zone_name VARCHAR(100),  -- State/province name
  
  -- Contact
  telephone VARCHAR(50),
  
  -- Flags
  is_default_billing BOOLEAN DEFAULT false,
  is_default_shipping BOOLEAN DEFAULT false,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  CONSTRAINT customer_addresses_type_check 
    CHECK (address_type IN ('billing', 'shipping', 'registered', 'mailing'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customer_addresses_entity_id ON public.customer_addresses(customer_entity_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_addresses_type ON public.customer_addresses(address_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_addresses_default_billing ON public.customer_addresses(is_default_billing) WHERE deleted_at IS NULL AND is_default_billing = true;
CREATE INDEX IF NOT EXISTS idx_customer_addresses_default_shipping ON public.customer_addresses(is_default_shipping) WHERE deleted_at IS NULL AND is_default_shipping = true;

-- Trigger for updated_at
CREATE TRIGGER update_customer_addresses_updated_at
BEFORE UPDATE ON public.customer_addresses
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Customer addresses are viewable by authenticated users" ON public.customer_addresses;
CREATE POLICY "Customer addresses are viewable by authenticated users" 
ON public.customer_addresses
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Customer addresses are manageable by authenticated users" ON public.customer_addresses;
CREATE POLICY "Customer addresses are manageable by authenticated users" 
ON public.customer_addresses
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_addresses TO authenticated;

-- Comments
COMMENT ON TABLE public.customer_addresses IS 'Multiple addresses for customer entities (persons and companies)';
COMMENT ON COLUMN public.customer_addresses.address_type IS 'Type: billing, shipping, registered (székhely), mailing (levelezési)';
COMMENT ON COLUMN public.customer_addresses.country_code IS 'ISO country code (e.g., HU, DE, AT)';
