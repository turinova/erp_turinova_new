-- Fees catalog + order fee lines (tenant DB)

CREATE TABLE IF NOT EXISTS public.fee_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'OTHER',
  default_vat_rate NUMERIC(5,2) NOT NULL DEFAULT 27,
  default_net NUMERIC(12,2),
  default_gross NUMERIC(12,2),
  price_mode TEXT NOT NULL DEFAULT 'manual_only',
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_system BOOLEAN NOT NULL DEFAULT false,
  allow_manual_edit BOOLEAN NOT NULL DEFAULT true,
  allow_delete_from_order BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT fee_definitions_type_check CHECK (type IN ('SHIPPING','PAYMENT','PACKAGING','STORAGE','SERVICE','OTHER')),
  CONSTRAINT fee_definitions_price_mode_check CHECK (price_mode IN ('fixed','per_order','manual_only'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fee_definitions_tenant_code
ON public.fee_definitions(tenant_id, code)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_fee_definitions_active
ON public.fee_definitions(is_active, sort_order)
WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS update_fee_definitions_updated_at ON public.fee_definitions;
CREATE TRIGGER update_fee_definitions_updated_at
  BEFORE UPDATE ON public.fee_definitions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.fee_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Fee definitions are viewable by authenticated users" ON public.fee_definitions;
CREATE POLICY "Fee definitions are viewable by authenticated users"
ON public.fee_definitions
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Fee definitions are manageable by authenticated users" ON public.fee_definitions;
CREATE POLICY "Fee definitions are manageable by authenticated users"
ON public.fee_definitions
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fee_definitions TO authenticated;

CREATE TABLE IF NOT EXISTS public.order_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  fee_definition_id UUID REFERENCES public.fee_definitions(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  type TEXT NOT NULL DEFAULT 'OTHER',
  name TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
  unit_net NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit_gross NUMERIC(12,2) NOT NULL DEFAULT 0,
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 27,
  line_net NUMERIC(12,2) NOT NULL DEFAULT 0,
  line_gross NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency_code TEXT NOT NULL DEFAULT 'HUF',
  sort_order INTEGER NOT NULL DEFAULT 100,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT order_fees_type_check CHECK (type IN ('SHIPPING','PAYMENT','PACKAGING','STORAGE','SERVICE','OTHER')),
  CONSTRAINT order_fees_source_check CHECK (source IN ('import_webshop','catalog_default','manual','system')),
  CONSTRAINT order_fees_quantity_positive CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_order_fees_order_id
ON public.order_fees(order_id)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_order_fees_order_type
ON public.order_fees(order_id, type)
WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS update_order_fees_updated_at ON public.order_fees;
CREATE TRIGGER update_order_fees_updated_at
  BEFORE UPDATE ON public.order_fees
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.order_fees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Order fees are viewable by authenticated users" ON public.order_fees;
CREATE POLICY "Order fees are viewable by authenticated users"
ON public.order_fees
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Order fees are manageable by authenticated users" ON public.order_fees;
CREATE POLICY "Order fees are manageable by authenticated users"
ON public.order_fees
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_fees TO authenticated;

INSERT INTO public.fee_definitions
  (tenant_id, code, name, type, default_vat_rate, price_mode, is_system, allow_manual_edit, allow_delete_from_order, sort_order)
VALUES
  (NULL, 'SHIPPING', 'Szállítási díj', 'SHIPPING', 27, 'manual_only', true, true, true, 10),
  (NULL, 'PAYMENT_FEE', 'Fizetési díj', 'PAYMENT', 27, 'manual_only', true, true, true, 20),
  (NULL, 'PACKAGING', 'Csomagolási díj', 'PACKAGING', 27, 'manual_only', false, true, true, 30),
  (NULL, 'STORAGE', 'Tárolási díj', 'STORAGE', 27, 'manual_only', false, true, true, 40),
  (NULL, 'SERVICE', 'Szolgáltatási díj', 'SERVICE', 27, 'manual_only', false, true, true, 50)
ON CONFLICT (tenant_id, code) WHERE deleted_at IS NULL DO NOTHING;

