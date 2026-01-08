-- Add IMAP settings to smtp_settings table for copying sent emails to Sent folder
-- IMAP is required for all email accounts

ALTER TABLE public.smtp_settings
ADD COLUMN IF NOT EXISTS imap_host character varying(255),
ADD COLUMN IF NOT EXISTS imap_port integer DEFAULT 993,
ADD COLUMN IF NOT EXISTS imap_secure boolean DEFAULT true;

-- Set default IMAP values for existing records (using SMTP host, port 993, secure true)
UPDATE public.smtp_settings
SET 
  imap_host = host,
  imap_port = 993,
  imap_secure = true
WHERE imap_host IS NULL;

-- Make IMAP fields NOT NULL after setting defaults
ALTER TABLE public.smtp_settings
ALTER COLUMN imap_host SET NOT NULL,
ALTER COLUMN imap_port SET NOT NULL,
ALTER COLUMN imap_secure SET NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.smtp_settings.imap_host IS 'IMAP server hostname for accessing Sent folder (usually same as SMTP host)';
COMMENT ON COLUMN public.smtp_settings.imap_port IS 'IMAP server port (usually 993 for SSL, 143 for TLS)';
COMMENT ON COLUMN public.smtp_settings.imap_secure IS 'Use SSL/TLS for IMAP connection (true for port 993, false for port 143)';

