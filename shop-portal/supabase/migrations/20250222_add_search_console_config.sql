-- Add Search Console configuration to webshop_connections
-- Run this SQL manually in your Supabase SQL Editor

ALTER TABLE public.webshop_connections
ADD COLUMN IF NOT EXISTS search_console_property_url TEXT,
ADD COLUMN IF NOT EXISTS search_console_client_email TEXT,
ADD COLUMN IF NOT EXISTS search_console_private_key TEXT,
ADD COLUMN IF NOT EXISTS search_console_enabled BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.webshop_connections.search_console_property_url IS 
'Google Search Console property URL (e.g., https://vasalatmester.hu or sc-domain:vasalatmester.hu)';

COMMENT ON COLUMN public.webshop_connections.search_console_client_email IS 
'Google Service Account email for Search Console API access';

COMMENT ON COLUMN public.webshop_connections.search_console_private_key IS 
'Google Service Account private key (encrypted in production)';

COMMENT ON COLUMN public.webshop_connections.search_console_enabled IS 
'Whether Search Console integration is enabled for this connection';
