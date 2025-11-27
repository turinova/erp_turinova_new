-- Create smtp_settings table (one record per database/tenant)
CREATE TABLE IF NOT EXISTS public.smtp_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  host character varying(255) NOT NULL,
  port integer NOT NULL DEFAULT 465,
  secure boolean NOT NULL DEFAULT true, -- true for 465 (SSL), false for 587 (TLS)
  "user" character varying(255) NOT NULL,
  password text NOT NULL, -- Store encrypted password
  from_email character varying(255) NOT NULL,
  from_name character varying(255) NOT NULL DEFAULT 'Turinova',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT smtp_settings_pkey PRIMARY KEY (id)
);

-- Index for active settings (only one should exist)
CREATE INDEX IF NOT EXISTS idx_smtp_settings_active 
  ON public.smtp_settings(is_active) 
  WHERE deleted_at IS NULL AND is_active = true;

-- Trigger for updated_at
CREATE TRIGGER trigger_update_smtp_settings_updated_at
  BEFORE UPDATE ON public.smtp_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to ensure only one active setting
CREATE OR REPLACE FUNCTION ensure_one_active_smtp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE public.smtp_settings
    SET is_active = false
    WHERE id != NEW.id
      AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ensure_one_active_smtp
  AFTER INSERT OR UPDATE ON public.smtp_settings
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION ensure_one_active_smtp();

-- Add page to pages table
INSERT INTO public.pages (path, name, description, category, is_active) 
VALUES (
  '/email-settings',
  'Email beállítások',
  'SMTP email beállítások kezelése',
  'Beállítások',
  true
)
ON CONFLICT (path) DO NOTHING;

