-- =============================================================================
-- Connection Shipping Method Mappings (per-webshop shipping method mapping)
-- Same pattern as shoprenter_tax_class_mappings: platform code -> ERP shipping_method_id
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.connection_shipping_method_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.webshop_connections(id) ON DELETE CASCADE,
  shipping_method_id UUID NOT NULL REFERENCES public.shipping_methods(id) ON DELETE CASCADE,
  platform_shipping_code TEXT NOT NULL,
  platform_shipping_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(connection_id, platform_shipping_code),
  UNIQUE(connection_id, shipping_method_id)
);

CREATE INDEX IF NOT EXISTS idx_connection_shipping_mappings_connection
  ON public.connection_shipping_method_mappings(connection_id);

CREATE INDEX IF NOT EXISTS idx_connection_shipping_mappings_shipping_method
  ON public.connection_shipping_method_mappings(shipping_method_id);

DROP TRIGGER IF EXISTS update_connection_shipping_method_mappings_updated_at ON public.connection_shipping_method_mappings;
CREATE TRIGGER update_connection_shipping_method_mappings_updated_at
  BEFORE UPDATE ON public.connection_shipping_method_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.connection_shipping_method_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Connection shipping mappings are viewable by authenticated users" ON public.connection_shipping_method_mappings;
CREATE POLICY "Connection shipping mappings are viewable by authenticated users"
  ON public.connection_shipping_method_mappings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Connection shipping mappings are manageable by authenticated users" ON public.connection_shipping_method_mappings;
CREATE POLICY "Connection shipping mappings are manageable by authenticated users"
  ON public.connection_shipping_method_mappings FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.connection_shipping_method_mappings TO authenticated;

COMMENT ON TABLE public.connection_shipping_method_mappings IS 'Per-connection mapping: platform shipping code (e.g. extension) -> ERP shipping_method_id. Used when processing order buffer.';
