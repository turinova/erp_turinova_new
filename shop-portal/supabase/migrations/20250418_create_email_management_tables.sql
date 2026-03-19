-- Email management: SMTP connection (max one active) + sending identities + outbound log
-- Run on TENANT database.

-- 1) SMTP connection (single active row per tenant DB)
CREATE TABLE IF NOT EXISTS public.email_smtp_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_type VARCHAR(32) NOT NULL DEFAULT 'smtp_custom',
  host VARCHAR(255) NOT NULL,
  port INTEGER NOT NULL DEFAULT 587,
  secure BOOLEAN NOT NULL DEFAULT false,
  smtp_username VARCHAR(512) NOT NULL,
  password TEXT NOT NULL,
  imap_host VARCHAR(255),
  imap_port INTEGER,
  imap_secure BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT email_smtp_connections_provider_type_chk
    CHECK (provider_type IN ('smtp_custom', 'gmail_oauth', 'microsoft_oauth'))
);

CREATE UNIQUE INDEX IF NOT EXISTS email_smtp_connections_one_active
  ON public.email_smtp_connections ((1))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_email_smtp_connections_deleted_at
  ON public.email_smtp_connections(deleted_at);

DROP TRIGGER IF EXISTS update_email_smtp_connections_updated_at ON public.email_smtp_connections;
CREATE TRIGGER update_email_smtp_connections_updated_at
  BEFORE UPDATE ON public.email_smtp_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 2) Sending identities (from name, email, signature)
CREATE TABLE IF NOT EXISTS public.email_sending_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.email_smtp_connections(id) ON DELETE RESTRICT,
  from_name VARCHAR(255) NOT NULL,
  from_email VARCHAR(255) NOT NULL,
  signature_html TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS email_sending_identities_from_email_unique
  ON public.email_sending_identities (lower(trim(from_email)))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_email_sending_identities_connection
  ON public.email_sending_identities(connection_id)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS update_email_sending_identities_updated_at ON public.email_sending_identities;
CREATE TRIGGER update_email_sending_identities_updated_at
  BEFORE UPDATE ON public.email_sending_identities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- First identity for a connection becomes default
CREATE OR REPLACE FUNCTION public.email_identities_first_is_default()
RETURNS TRIGGER AS $$
DECLARE
  others INT;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  SELECT COUNT(*) INTO others
  FROM public.email_sending_identities
  WHERE connection_id = NEW.connection_id
    AND deleted_at IS NULL
    AND id IS DISTINCT FROM NEW.id;

  IF others = 0 THEN
    NEW.is_default := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_email_identities_first_default ON public.email_sending_identities;
CREATE TRIGGER trg_email_identities_first_default
  BEFORE INSERT ON public.email_sending_identities
  FOR EACH ROW
  EXECUTE FUNCTION public.email_identities_first_is_default();

-- Only one default per connection (non-deleted)
CREATE OR REPLACE FUNCTION public.email_identities_single_default()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.is_default IS TRUE THEN
    UPDATE public.email_sending_identities
    SET is_default = false,
        updated_at = now()
    WHERE connection_id = NEW.connection_id
      AND deleted_at IS NULL
      AND id IS DISTINCT FROM NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_email_identities_single_default_ins ON public.email_sending_identities;
CREATE TRIGGER trg_email_identities_single_default_ins
  BEFORE INSERT ON public.email_sending_identities
  FOR EACH ROW
  EXECUTE FUNCTION public.email_identities_single_default();

DROP TRIGGER IF EXISTS trg_email_identities_single_default_upd ON public.email_sending_identities;
CREATE TRIGGER trg_email_identities_single_default_upd
  BEFORE UPDATE ON public.email_sending_identities
  FOR EACH ROW
  WHEN (NEW.is_default IS TRUE AND (NEW.deleted_at IS NULL))
  EXECUTE FUNCTION public.email_identities_single_default();

-- If default identity is soft-deleted, promote another
CREATE OR REPLACE FUNCTION public.email_identities_promote_after_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL
     AND OLD.deleted_at IS NULL
     AND OLD.is_default IS TRUE
  THEN
    UPDATE public.email_sending_identities i
    SET is_default = true,
        updated_at = now()
    WHERE i.id = (
      SELECT s.id
      FROM public.email_sending_identities s
      WHERE s.connection_id = OLD.connection_id
        AND s.deleted_at IS NULL
        AND s.id <> OLD.id
      ORDER BY s.created_at ASC
      LIMIT 1
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_email_identities_promote_default ON public.email_sending_identities;
CREATE TRIGGER trg_email_identities_promote_default
  AFTER UPDATE OF deleted_at ON public.email_sending_identities
  FOR EACH ROW
  EXECUTE FUNCTION public.email_identities_promote_after_soft_delete();

-- 3) Outbound messages (test + future automations)
CREATE TABLE IF NOT EXISTS public.email_outbound_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel VARCHAR(32) NOT NULL DEFAULT 'email',
  kind VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  to_address VARCHAR(512) NOT NULL,
  subject VARCHAR(998),
  identity_id UUID REFERENCES public.email_sending_identities(id) ON DELETE SET NULL,
  provider_message_id TEXT,
  error_text TEXT,
  body_preview TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_email_outbound_created_at
  ON public.email_outbound_messages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_outbound_kind
  ON public.email_outbound_messages(kind);

-- RLS
ALTER TABLE public.email_smtp_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sending_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_outbound_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_smtp_connections_select ON public.email_smtp_connections;
CREATE POLICY email_smtp_connections_select ON public.email_smtp_connections
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS email_smtp_connections_all ON public.email_smtp_connections;
CREATE POLICY email_smtp_connections_all ON public.email_smtp_connections
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS email_sending_identities_select ON public.email_sending_identities;
CREATE POLICY email_sending_identities_select ON public.email_sending_identities
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS email_sending_identities_all ON public.email_sending_identities;
CREATE POLICY email_sending_identities_all ON public.email_sending_identities
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS email_outbound_messages_select ON public.email_outbound_messages;
CREATE POLICY email_outbound_messages_select ON public.email_outbound_messages
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS email_outbound_messages_insert ON public.email_outbound_messages;
CREATE POLICY email_outbound_messages_insert ON public.email_outbound_messages
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS email_outbound_messages_update ON public.email_outbound_messages;
CREATE POLICY email_outbound_messages_update ON public.email_outbound_messages
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_smtp_connections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_sending_identities TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.email_outbound_messages TO authenticated;

COMMENT ON TABLE public.email_smtp_connections IS 'Single active SMTP connection per tenant (enforced by unique partial index)';
COMMENT ON TABLE public.email_sending_identities IS 'From name, email, and HTML signature for outbound mail';
COMMENT ON TABLE public.email_outbound_messages IS 'Outbound email audit trail (test sends, future transactional)';
