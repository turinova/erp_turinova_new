-- Create sequence for client offer numbers
CREATE SEQUENCE IF NOT EXISTS public.client_offer_seq START 1;

-- Function to generate client offer number: CLO-YYYY-0000001
CREATE OR REPLACE FUNCTION public.generate_client_offer_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_year text := to_char(now() at time zone 'UTC', 'YYYY');
  v_seq bigint;
  v_number text;
BEGIN
  v_seq := nextval('public.client_offer_seq');
  -- Format: CLO-YYYY-0000001 (7 digits)
  v_number := format('CLO-%s-%07d', v_year, v_seq);
  RETURN v_number;
END;
$$;

-- Create client_offers table
CREATE TABLE IF NOT EXISTS public.client_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_number text NOT NULL UNIQUE DEFAULT public.generate_client_offer_number(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  worker_id uuid REFERENCES public.workers(id) ON DELETE SET NULL,
  
  -- Customer snapshot (for display/history)
  customer_name text NOT NULL,
  customer_email text,
  customer_mobile text,
  
  -- Billing information
  billing_name text,
  billing_country text DEFAULT 'Magyarország',
  billing_city text,
  billing_postal_code text,
  billing_street text,
  billing_house_number text,
  billing_tax_number text,
  billing_company_reg_number text,
  
  -- Financial totals
  subtotal_net numeric(12,2) DEFAULT 0,
  total_vat numeric(12,2) DEFAULT 0,
  total_gross numeric(12,2) DEFAULT 0,
  discount_percentage numeric(5,2) DEFAULT 0,
  discount_amount numeric(12,2) DEFAULT 0,
  
  -- Status
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected')),
  
  -- Metadata
  notes text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- Create client_offers_items table
CREATE TABLE IF NOT EXISTS public.client_offers_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_offer_id uuid NOT NULL REFERENCES public.client_offers(id) ON DELETE CASCADE,
  
  -- Item type: 'product', 'material', 'accessory', 'linear_material', 'fee'
  item_type text NOT NULL CHECK (item_type IN ('product', 'material', 'accessory', 'linear_material', 'fee')),
  
  -- Product/Material/Accessory references (one will be set, others null)
  material_id uuid REFERENCES public.materials(id) ON DELETE SET NULL,
  accessory_id uuid REFERENCES public.accessories(id) ON DELETE SET NULL,
  linear_material_id uuid REFERENCES public.linear_materials(id) ON DELETE SET NULL,
  fee_type_id uuid REFERENCES public.feetypes(id) ON DELETE SET NULL,
  
  -- Item details (snapshot for history)
  product_name text NOT NULL,
  sku text,
  unit text,
  
  -- Pricing
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit_price_net numeric(12,2) NOT NULL,
  unit_price_gross numeric(12,2) NOT NULL,
  vat_id uuid REFERENCES public.vat(id),
  vat_percentage numeric(5,2),
  total_net numeric(12,2) NOT NULL,
  total_vat numeric(12,2) NOT NULL,
  total_gross numeric(12,2) NOT NULL,
  
  -- Metadata
  notes text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- Create indexes for client_offers
CREATE INDEX IF NOT EXISTS idx_client_offers_customer_id ON public.client_offers(customer_id);
CREATE INDEX IF NOT EXISTS idx_client_offers_status ON public.client_offers(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_client_offers_created_at ON public.client_offers(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_client_offers_offer_number ON public.client_offers(offer_number);
CREATE INDEX IF NOT EXISTS idx_client_offers_created_by ON public.client_offers(created_by) WHERE deleted_at IS NULL;

-- Create indexes for client_offers_items
CREATE INDEX IF NOT EXISTS idx_client_offers_items_offer_id ON public.client_offers_items(client_offer_id);
CREATE INDEX IF NOT EXISTS idx_client_offers_items_material_id ON public.client_offers_items(material_id);
CREATE INDEX IF NOT EXISTS idx_client_offers_items_accessory_id ON public.client_offers_items(accessory_id);
CREATE INDEX IF NOT EXISTS idx_client_offers_items_linear_material_id ON public.client_offers_items(linear_material_id);
CREATE INDEX IF NOT EXISTS idx_client_offers_items_fee_type_id ON public.client_offers_items(fee_type_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_client_offers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_client_offers_updated_at
  BEFORE UPDATE ON public.client_offers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_client_offers_updated_at();

CREATE OR REPLACE FUNCTION public.update_client_offers_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_client_offers_items_updated_at
  BEFORE UPDATE ON public.client_offers_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_client_offers_items_updated_at();

