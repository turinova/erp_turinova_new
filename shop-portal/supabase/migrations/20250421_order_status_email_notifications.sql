-- Order status → customer e-mail templates, send log idempotency, outbound metadata.
-- Run on TENANT database after 20250418_create_email_management_tables.sql and orders table exists.

-- ---------------------------------------------------------------------------
-- 1) Templates per order status (one row per status)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_status_email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_status TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  subject_template TEXT NOT NULL,
  body_html TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT order_status_email_templates_status_unique UNIQUE (order_status),
  CONSTRAINT order_status_email_templates_status_ck CHECK (order_status IN (
    'pending_review',
    'new',
    'picking',
    'picked',
    'verifying',
    'packing',
    'awaiting_carrier',
    'shipped',
    'ready_for_pickup',
    'delivered',
    'cancelled',
    'refunded'
  ))
);

CREATE INDEX IF NOT EXISTS idx_order_status_email_templates_enabled
  ON public.order_status_email_templates (enabled)
  WHERE enabled = true;

DROP TRIGGER IF EXISTS update_order_status_email_templates_updated_at ON public.order_status_email_templates;
CREATE TRIGGER update_order_status_email_templates_updated_at
  BEFORE UPDATE ON public.order_status_email_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.order_status_email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_status_email_templates_select ON public.order_status_email_templates;
CREATE POLICY order_status_email_templates_select ON public.order_status_email_templates
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS order_status_email_templates_all ON public.order_status_email_templates;
CREATE POLICY order_status_email_templates_all ON public.order_status_email_templates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_status_email_templates TO authenticated;

COMMENT ON TABLE public.order_status_email_templates IS 'Per-status customer notification e-mail templates; placeholders {{customer_firstname}} etc.';

-- ---------------------------------------------------------------------------
-- 2) Idempotency: one sent notification per (order, target status value)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_status_notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  notified_status TEXT NOT NULL,
  email_outbound_message_id UUID REFERENCES public.email_outbound_messages(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT order_status_notification_log_unique UNIQUE (order_id, notified_status)
);

CREATE INDEX IF NOT EXISTS idx_order_status_notification_log_order_id
  ON public.order_status_notification_log (order_id);

ALTER TABLE public.order_status_notification_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_status_notification_log_select ON public.order_status_notification_log;
CREATE POLICY order_status_notification_log_select ON public.order_status_notification_log
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS order_status_notification_log_insert ON public.order_status_notification_log;
CREATE POLICY order_status_notification_log_insert ON public.order_status_notification_log
  FOR INSERT TO authenticated WITH CHECK (true);

GRANT SELECT, INSERT ON public.order_status_notification_log TO authenticated;

COMMENT ON TABLE public.order_status_notification_log IS 'Prevents duplicate customer e-mails for the same order+status milestone';

-- ---------------------------------------------------------------------------
-- 3) Outbound log: link to order + JSON metadata
-- ---------------------------------------------------------------------------
ALTER TABLE public.email_outbound_messages
  ADD COLUMN IF NOT EXISTS related_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL;

ALTER TABLE public.email_outbound_messages
  ADD COLUMN IF NOT EXISTS metadata JSONB;

CREATE INDEX IF NOT EXISTS idx_email_outbound_related_order_id
  ON public.email_outbound_messages (related_order_id)
  WHERE related_order_id IS NOT NULL;

COMMENT ON COLUMN public.email_outbound_messages.related_order_id IS 'Order linked to this outbound message (e.g. order status notification)';
COMMENT ON COLUMN public.email_outbound_messages.metadata IS 'Extra context: template key, order_status, etc.';

-- ---------------------------------------------------------------------------
-- 4) Seed rows (all disabled by default)
-- ---------------------------------------------------------------------------
INSERT INTO public.order_status_email_templates (order_status, enabled, subject_template, body_html, sort_order)
VALUES
  ('pending_review', false, 'Rendelés {{order_number}} — {{status_label}}', '<p>Kedves {{customer_firstname}}!</p><p>Rendelésének állapota: <strong>{{status_label}}</strong> ({{order_number}}).</p><p>Üdvözlettel,<br/>{{shop_name}}</p>', 5),
  ('new', false, 'Rendelés {{order_number}} — {{status_label}}', '<p>Kedves {{customer_firstname}}!</p><p>Megkaptuk rendelését (<strong>{{order_number}}</strong>). Állapot: <strong>{{status_label}}</strong>.</p><p>Üdvözlettel,<br/>{{shop_name}}</p>', 10),
  ('picking', false, 'Rendelés {{order_number}} — {{status_label}}', '<p>Kedves {{customer_firstname}}!</p><p>Rendelése (<strong>{{order_number}}</strong>) jelenleg <strong>{{status_label}}</strong> fázisban van.</p><p>Üdvözlettel,<br/>{{shop_name}}</p>', 20),
  ('picked', false, 'Rendelés {{order_number}} — {{status_label}}', '<p>Kedves {{customer_firstname}}!</p><p>Rendelése (<strong>{{order_number}}</strong>) állapota: <strong>{{status_label}}</strong>.</p><p>Üdvözlettel,<br/>{{shop_name}}</p>', 30),
  ('verifying', false, 'Rendelés {{order_number}} — {{status_label}}', '<p>Kedves {{customer_firstname}}!</p><p>Rendelése (<strong>{{order_number}}</strong>) ellenőrzés alatt áll.</p><p>Üdvözlettel,<br/>{{shop_name}}</p>', 40),
  ('packing', false, 'Rendelés {{order_number}} — {{status_label}}', '<p>Kedves {{customer_firstname}}!</p><p>Rendelése (<strong>{{order_number}}</strong>) csomagolás alatt van.</p><p>Üdvözlettel,<br/>{{shop_name}}</p>', 50),
  ('awaiting_carrier', false, 'Rendelés {{order_number}} — {{status_label}}', '<p>Kedves {{customer_firstname}}!</p><p>Rendelése (<strong>{{order_number}}</strong>) készen áll az átadásra a futárszolgálatnak.</p><p>Üdvözlettel,<br/>{{shop_name}}</p>', 60),
  ('shipped', false, 'Rendelés {{order_number}} — úton', '<p>Kedves {{customer_firstname}}!</p><p>Rendelése (<strong>{{order_number}}</strong>) átadásra került a szállítónak.</p><p>Üdvözlettel,<br/>{{shop_name}}</p>', 70),
  ('ready_for_pickup', false, 'Rendelés {{order_number}} — átvehető', '<p>Kedves {{customer_firstname}}!</p><p>Rendelése (<strong>{{order_number}}</strong>) átvehető.</p><p>Üdvözlettel,<br/>{{shop_name}}</p>', 80),
  ('delivered', false, 'Rendelés {{order_number}} — kézbesítve', '<p>Kedves {{customer_firstname}}!</p><p>Rendelése (<strong>{{order_number}}</strong>) kézbesítésre került. Köszönjük a vásárlást!</p><p>Üdvözlettel,<br/>{{shop_name}}</p>', 90),
  ('cancelled', false, 'Rendelés {{order_number}} — törölve', '<p>Kedves {{customer_firstname}}!</p><p>Rendelése (<strong>{{order_number}}</strong>) törölve lett.</p><p>Üdvözlettel,<br/>{{shop_name}}</p>', 100),
  ('refunded', false, 'Rendelés {{order_number}} — visszatérítve', '<p>Kedves {{customer_firstname}}!</p><p>Rendelése (<strong>{{order_number}}</strong>) kapcsán a visszatérítés feldolgozásra került.</p><p>Üdvözlettel,<br/>{{shop_name}}</p>', 110)
ON CONFLICT (order_status) DO NOTHING;
