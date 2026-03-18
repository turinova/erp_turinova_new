-- Add optional carrier API credentials per shipping method (e.g. Express One: ügyfél kód, API user, API password)
-- Store per method; for pickup (requires_pickup_point) leave null. Encrypt api_password at app layer if needed.

ALTER TABLE public.shipping_methods
  ADD COLUMN IF NOT EXISTS carrier_provider TEXT,
  ADD COLUMN IF NOT EXISTS customer_code TEXT,
  ADD COLUMN IF NOT EXISTS api_username TEXT,
  ADD COLUMN IF NOT EXISTS api_password TEXT;

COMMENT ON COLUMN public.shipping_methods.carrier_provider IS 'Carrier integration: e.g. express_one, gls, manual';
COMMENT ON COLUMN public.shipping_methods.customer_code IS 'Ügyfél kód / customer code from carrier';
COMMENT ON COLUMN public.shipping_methods.api_username IS 'API felhasználónév';
COMMENT ON COLUMN public.shipping_methods.api_password IS 'API jelszó (consider encrypting at application layer)';
