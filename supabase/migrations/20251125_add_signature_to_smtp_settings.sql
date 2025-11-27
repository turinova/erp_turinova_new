-- Add signature_html column to smtp_settings table
ALTER TABLE public.smtp_settings
  ADD COLUMN IF NOT EXISTS signature_html text NULL;

