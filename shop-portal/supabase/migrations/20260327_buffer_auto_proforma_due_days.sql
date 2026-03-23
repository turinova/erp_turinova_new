-- Számlázz: automatic buffer díjbekérő — fizetési határidő (napok száma a kiállítás napjától).
-- Run on each TENANT database.

ALTER TABLE public.webshop_connections
  ADD COLUMN IF NOT EXISTS buffer_auto_proforma_due_days INTEGER NOT NULL DEFAULT 8;

ALTER TABLE public.webshop_connections
  DROP CONSTRAINT IF EXISTS webshop_connections_buffer_auto_proforma_due_days_check;

ALTER TABLE public.webshop_connections
  ADD CONSTRAINT webshop_connections_buffer_auto_proforma_due_days_check
  CHECK (buffer_auto_proforma_due_days >= 0 AND buffer_auto_proforma_due_days <= 365);

COMMENT ON COLUMN public.webshop_connections.buffer_auto_proforma_due_days IS
  'For automatic buffer díjbekérő: calendar days from invoice issue date to payment due date (fizetési határidő).';
