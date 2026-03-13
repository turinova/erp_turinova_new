-- =============================================================================
-- Connection Payment Method Mappings (per-webshop payment method mapping)
-- Same pattern as shoprenter_tax_class_mappings: platform code -> ERP payment_method_id
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.connection_payment_method_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.webshop_connections(id) ON DELETE CASCADE,
  payment_method_id UUID NOT NULL REFERENCES public.payment_methods(id) ON DELETE CASCADE,
  platform_payment_code TEXT NOT NULL,
  platform_payment_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(connection_id, platform_payment_code),
  UNIQUE(connection_id, payment_method_id)
);

CREATE INDEX IF NOT EXISTS idx_connection_payment_mappings_connection
  ON public.connection_payment_method_mappings(connection_id);

CREATE INDEX IF NOT EXISTS idx_connection_payment_mappings_payment_method
  ON public.connection_payment_method_mappings(payment_method_id);

DROP TRIGGER IF EXISTS update_connection_payment_method_mappings_updated_at ON public.connection_payment_method_mappings;
CREATE TRIGGER update_connection_payment_method_mappings_updated_at
  BEFORE UPDATE ON public.connection_payment_method_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.connection_payment_method_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Connection payment mappings are viewable by authenticated users" ON public.connection_payment_method_mappings;
CREATE POLICY "Connection payment mappings are viewable by authenticated users"
  ON public.connection_payment_method_mappings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Connection payment mappings are manageable by authenticated users" ON public.connection_payment_method_mappings;
CREATE POLICY "Connection payment mappings are manageable by authenticated users"
  ON public.connection_payment_method_mappings FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.connection_payment_method_mappings TO authenticated;

COMMENT ON TABLE public.connection_payment_method_mappings IS 'Per-connection mapping: platform payment code (e.g. ShopRenter) -> ERP payment_method_id. Used when processing order buffer.';
