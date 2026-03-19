-- Outbound e-mail channel → identity mapping (single row per tenant).
-- PO and order-status senders are chosen here; wiring to those features comes later.
-- Run on TENANT database after 20250418_create_email_management_tables.sql

CREATE TABLE IF NOT EXISTS public.email_outbound_channel_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_identity_id UUID REFERENCES public.email_sending_identities(id) ON DELETE SET NULL,
  order_status_notification_identity_id UUID REFERENCES public.email_sending_identities(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS email_outbound_channel_settings_single_row
  ON public.email_outbound_channel_settings ((1));

DROP TRIGGER IF EXISTS update_email_outbound_channel_settings_updated_at ON public.email_outbound_channel_settings;
CREATE TRIGGER update_email_outbound_channel_settings_updated_at
  BEFORE UPDATE ON public.email_outbound_channel_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.email_outbound_channel_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_outbound_channel_settings_select ON public.email_outbound_channel_settings;
CREATE POLICY email_outbound_channel_settings_select ON public.email_outbound_channel_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS email_outbound_channel_settings_all ON public.email_outbound_channel_settings;
CREATE POLICY email_outbound_channel_settings_all ON public.email_outbound_channel_settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_outbound_channel_settings TO authenticated;

COMMENT ON TABLE public.email_outbound_channel_settings IS 'Maps outbound use cases to sending identities; one row per tenant';
COMMENT ON COLUMN public.email_outbound_channel_settings.purchase_order_identity_id IS 'Default From identity for supplier / PO e-mail (when implemented)';
COMMENT ON COLUMN public.email_outbound_channel_settings.order_status_notification_identity_id IS 'From identity for order status notifications (when implemented)';
