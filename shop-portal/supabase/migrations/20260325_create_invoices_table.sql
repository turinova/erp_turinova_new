-- Shop Portal — outgoing invoices (Számlázz.hu / future providers)
-- Run manually in each TENANT Supabase SQL Editor after webshop_connections + orders exist.
-- Mirrors main-app invoices shape (see repo root supabase/migrations/20251215_*) + connection_id for SaaS.

CREATE SEQUENCE IF NOT EXISTS public.invoice_internal_seq START 1;

CREATE OR REPLACE FUNCTION public.next_internal_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_year TEXT := to_char(now() AT TIME ZONE 'UTC', 'YYYY');
  v_seq BIGINT;
BEGIN
  v_seq := nextval('public.invoice_internal_seq');
  RETURN format('INV-%s-%s', v_year, lpad(v_seq::text, 6, '0'));
END;
$$;

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_number TEXT NOT NULL UNIQUE DEFAULT public.next_internal_invoice_number(),
  provider TEXT NOT NULL DEFAULT 'szamlazz_hu',
  provider_invoice_number TEXT,
  provider_invoice_id TEXT,
  invoice_type TEXT NOT NULL,
  -- shop-portal web orders use related_order_type = 'order' + related_order_id -> orders.id
  related_order_type TEXT NOT NULL,
  related_order_id UUID,
  related_order_number TEXT,
  customer_name TEXT,
  customer_id UUID,
  payment_due_date DATE,
  fulfillment_date DATE,
  gross_total NUMERIC(12, 2),
  payment_status TEXT NOT NULL,
  is_storno_of_invoice_id UUID,
  pdf_url TEXT,
  connection_id UUID REFERENCES public.webshop_connections(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT invoices_is_storno_fk FOREIGN KEY (is_storno_of_invoice_id)
    REFERENCES public.invoices (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS invoices_provider_invoice_number_idx ON public.invoices (provider_invoice_number);
CREATE INDEX IF NOT EXISTS invoices_related_order_idx ON public.invoices (related_order_type, related_order_id);
CREATE INDEX IF NOT EXISTS invoices_internal_number_idx ON public.invoices (internal_number);
CREATE INDEX IF NOT EXISTS invoices_deleted_at_idx ON public.invoices (deleted_at);
CREATE INDEX IF NOT EXISTS invoices_connection_id_idx ON public.invoices (connection_id) WHERE connection_id IS NOT NULL;

COMMENT ON COLUMN public.invoices.connection_id IS 'Számlázz (or other) webshop_connections row used to issue this invoice.';
COMMENT ON COLUMN public.invoices.related_order_type IS 'order = shop-portal orders.id; future: pos_order etc.';

DROP TRIGGER IF EXISTS update_invoices_updated_at ON public.invoices;
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Invoices are viewable by authenticated users" ON public.invoices;
CREATE POLICY "Invoices are viewable by authenticated users" ON public.invoices
  FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Invoices are manageable by authenticated users" ON public.invoices;
CREATE POLICY "Invoices are manageable by authenticated users" ON public.invoices
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.invoice_internal_seq TO authenticated;
