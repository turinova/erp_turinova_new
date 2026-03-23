-- Buffer import: optional automatic díjbekérő (proforma) via Számlázz Agent.
-- Run on each TENANT database.

ALTER TABLE public.webshop_connections
  ADD COLUMN IF NOT EXISTS buffer_auto_proforma_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.webshop_connections.buffer_auto_proforma_enabled IS
  'If true (Számlázz connection): after buffer→order import, create díjbekérő when payment_methods.auto_proforma_on_import matches.';

ALTER TABLE public.payment_methods
  ADD COLUMN IF NOT EXISTS auto_proforma_on_import BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.payment_methods.auto_proforma_on_import IS
  'When true and a Számlázz connection has buffer_auto_proforma_enabled, buffer process creates díjbekérő for this payment method.';
