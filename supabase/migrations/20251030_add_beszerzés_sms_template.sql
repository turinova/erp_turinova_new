-- Migration: Add "Beszerzés" SMS template
-- Date: 2025-10-30
-- Description: Add new SMS template for procurement/shop orders notification

-- Insert the new "Beszerzés" template
INSERT INTO public.sms_settings (template_name, message_template)
VALUES (
  'Beszerzés',
  'Kedves {customer_name}! A beserzese ({order_date}) elkeszult, vegosszeg: {total_price}. Udvozlettel, {company_name}'
)
ON CONFLICT (template_name) DO NOTHING;

-- Add comment explaining the template
COMMENT ON TABLE public.sms_settings IS 'Stores customizable SMS notification message templates. Templates: "Készre jelentés" (order ready), "Tárolás figyelmeztetés" (storage warning), "Beszerzés" (procurement complete)';

