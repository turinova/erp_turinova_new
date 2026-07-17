-- Fronttervező: várható / tényleges beérkezés (csak dátum)
-- Manuálisan futtatható a tenant DB-n, ha a fő schema már lefutott.

ALTER TABLE public.fronttervezo_quotes
  ADD COLUMN IF NOT EXISTS expected_arrival_date date NULL,
  ADD COLUMN IF NOT EXISTS actual_arrival_date date NULL;

COMMENT ON COLUMN public.fronttervezo_quotes.expected_arrival_date IS
  'Várható beérkezés dátuma (Megrendelés modal)';
COMMENT ON COLUMN public.fronttervezo_quotes.actual_arrival_date IS
  'Tényleges beérkezés dátuma (orders detail)';
