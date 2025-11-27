-- Add email_template_html column to partners table
ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS email_template_html text NULL;

