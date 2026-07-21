CREATE TABLE IF NOT EXISTS public.portal_customer_facing_pdf_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  portal_customer_id uuid NOT NULL
    REFERENCES public.portal_customers (id) ON DELETE CASCADE,
  source text NOT NULL
    CHECK (source IN ('opti', 'nettfront')),
  quote_id uuid NOT NULL,
  quote_number text,
  quote_status text,
  generated_from text
    CHECK (generated_from IN ('saved', 'orders', 'unknown')),
  markup_percent numeric(7,2),
  manual_lines_count integer NOT NULL DEFAULT 0
    CHECK (manual_lines_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_portal_customer_facing_pdf_events_created_at
  ON public.portal_customer_facing_pdf_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_portal_customer_facing_pdf_events_customer_created
  ON public.portal_customer_facing_pdf_events (portal_customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_portal_customer_facing_pdf_events_source_created
  ON public.portal_customer_facing_pdf_events (source, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_portal_customer_facing_pdf_events_quote
  ON public.portal_customer_facing_pdf_events (source, quote_id, created_at DESC);

ALTER TABLE public.portal_customer_facing_pdf_events ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.portal_customer_facing_pdf_events IS
  'Append-only analytics log for successfully generated customer-facing PDFs in the customer portal.';

COMMENT ON COLUMN public.portal_customer_facing_pdf_events.generated_from IS
  'UI surface where generation was initiated: saved, orders, or unknown.';
