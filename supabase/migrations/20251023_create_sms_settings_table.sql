-- Migration: Create SMS settings table
-- Date: 2025-10-23
-- Description: Store customizable SMS notification templates

-- Create sms_settings table
CREATE TABLE IF NOT EXISTS public.sms_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  message_template text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sms_settings_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

-- Create trigger for updated_at
CREATE TRIGGER update_sms_settings_updated_at
  BEFORE UPDATE ON sms_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default SMS template (one row only)
INSERT INTO public.sms_settings (message_template) VALUES (
  'Kedves {customer_name}! Az On {order_number} szamu rendelese elkeszult es atvehetο. Udvozlettel, {company_name}'
) ON CONFLICT DO NOTHING;

-- Add /notifications page to pages table
INSERT INTO public.pages (path, name, description, category, is_active) VALUES (
  '/notifications',
  'Értesítések',
  'SMS értesítési üzenetek szerkesztése',
  'Beállítások',
  true
) ON CONFLICT (path) DO NOTHING;

-- Comment
COMMENT ON TABLE public.sms_settings IS 'Stores customizable SMS notification message templates';
COMMENT ON COLUMN public.sms_settings.message_template IS 'SMS message template with placeholders: {customer_name}, {order_number}, {company_name}, {material_name}';

