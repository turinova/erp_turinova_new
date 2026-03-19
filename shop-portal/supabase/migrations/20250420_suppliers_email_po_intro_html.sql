-- Beszállítói beszerzési rendelés e-mail bevezető (HTML), szerkeszthető a beszállító oldalon.
-- Run on TENANT database.

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS email_po_intro_html TEXT;

COMMENT ON COLUMN public.suppliers.email_po_intro_html IS 'HTML intro paragraph(s) prepended to PO e-mail body for this supplier';
