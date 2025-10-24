-- Migration: Add template_name to sms_settings table
-- Purpose: Support multiple SMS templates with descriptive names
-- Date: 2025-10-24

-- Add template_name column to sms_settings
ALTER TABLE public.sms_settings
ADD COLUMN template_name VARCHAR(100);

-- Add comment to explain the column
COMMENT ON COLUMN public.sms_settings.template_name IS 'Name of the SMS template (e.g., "Készre jelentés", "Tárolás figyelmeztetés")';

-- Update existing record to have a template name
UPDATE public.sms_settings
SET template_name = 'Készre jelentés'
WHERE template_name IS NULL;

-- Make template_name NOT NULL after updating existing records
ALTER TABLE public.sms_settings
ALTER COLUMN template_name SET NOT NULL;

-- Add unique constraint on template_name to prevent duplicates
ALTER TABLE public.sms_settings
ADD CONSTRAINT sms_settings_template_name_unique UNIQUE (template_name);

-- Insert the new "Tárolás figyelmeztetés" template
INSERT INTO public.sms_settings (template_name, message_template)
VALUES (
  'Tárolás figyelmeztetés',
  'Kedves {customer_name}! Az On {order_number} szamu rendelese mar {days} napja kesz es athvehetο. Kerem, vegye fel velunk a kapcsolatot! Udvozlettel, {company_name}'
)
ON CONFLICT (template_name) DO NOTHING;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_sms_settings_template_name ON public.sms_settings(template_name);

