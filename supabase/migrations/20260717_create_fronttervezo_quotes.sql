-- =====================================================
-- Fronttervező quotes system
-- Manuálisan futtatható a tenant DB-n.
-- Státusz: draft → ordered → ready → finished (+ cancelled)
-- Nincs gyártógép / in_production. Vonalkód: Megrendeléskor EAN-13.
-- Prefix: FQ- / FORD-
-- Előfeltétel: nettfront_skus, customers, feetypes, currencies, vat, auth.users
-- =====================================================

-- -----------------------------------------------------
-- 1) Header: fronttervezo_quotes
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fronttervezo_quotes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  quote_number character varying(50) NOT NULL,
  order_number text NULL,
  barcode text NULL,
  status public.quote_status NOT NULL DEFAULT 'draft'::public.quote_status,
  source text NOT NULL DEFAULT 'internal'
    CHECK (source IN ('internal', 'customer_portal')),

  discount_percent numeric(5, 2) NOT NULL DEFAULT 0,

  -- Front tételek összesítő
  lines_total_net numeric(12, 2) NOT NULL DEFAULT 0,
  lines_total_vat numeric(12, 2) NOT NULL DEFAULT 0,
  lines_total_gross numeric(12, 2) NOT NULL DEFAULT 0,

  -- Szolgáltatások (pl. pánthelyfúrás)
  services_total_net numeric(12, 2) NOT NULL DEFAULT 0,
  services_total_vat numeric(12, 2) NOT NULL DEFAULT 0,
  services_total_gross numeric(12, 2) NOT NULL DEFAULT 0,

  -- Díjak
  fees_total_net numeric(12, 2) NOT NULL DEFAULT 0,
  fees_total_vat numeric(12, 2) NOT NULL DEFAULT 0,
  fees_total_gross numeric(12, 2) NOT NULL DEFAULT 0,

  -- lines + services + fees (kedvezmény előtt)
  total_net numeric(12, 2) NOT NULL DEFAULT 0,
  total_vat numeric(12, 2) NOT NULL DEFAULT 0,
  total_gross numeric(12, 2) NOT NULL DEFAULT 0,
  final_total_after_discount numeric(12, 2) NOT NULL DEFAULT 0,

  payment_status text NULL DEFAULT 'not_paid'
    CHECK (payment_status IS NULL OR payment_status IN ('not_paid', 'partial', 'paid')),
  payment_method_id uuid NULL,
  comment text NULL,

  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,

  expected_arrival_date date NULL,
  actual_arrival_date date NULL,

  ordered_at timestamptz NULL,
  ready_at timestamptz NULL,
  finished_at timestamptz NULL,
  cancelled_at timestamptz NULL,
  ready_notification_sent_at timestamptz NULL,

  CONSTRAINT fronttervezo_quotes_pkey PRIMARY KEY (id),
  CONSTRAINT fronttervezo_quotes_quote_number_key UNIQUE (quote_number),
  CONSTRAINT fronttervezo_quotes_order_number_key UNIQUE (order_number),
  CONSTRAINT fronttervezo_quotes_barcode_key UNIQUE (barcode),
  CONSTRAINT fronttervezo_quotes_customer_id_fkey
    FOREIGN KEY (customer_id) REFERENCES public.customers (id) ON DELETE RESTRICT,
  CONSTRAINT fronttervezo_quotes_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE RESTRICT,
  CONSTRAINT fronttervezo_quotes_payment_method_id_fkey
    FOREIGN KEY (payment_method_id) REFERENCES public.payment_methods (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_fronttervezo_quotes_created_at
  ON public.fronttervezo_quotes (created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_fronttervezo_quotes_customer_id
  ON public.fronttervezo_quotes (customer_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_fronttervezo_quotes_status
  ON public.fronttervezo_quotes (status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_fronttervezo_quotes_quote_number
  ON public.fronttervezo_quotes (quote_number)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_fronttervezo_quotes_order_number
  ON public.fronttervezo_quotes (order_number)
  WHERE deleted_at IS NULL AND order_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fronttervezo_quotes_barcode
  ON public.fronttervezo_quotes (barcode)
  WHERE deleted_at IS NULL AND barcode IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fronttervezo_quotes_ordered_at
  ON public.fronttervezo_quotes (ordered_at)
  WHERE ordered_at IS NOT NULL AND deleted_at IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    DROP TRIGGER IF EXISTS update_fronttervezo_quotes_updated_at ON public.fronttervezo_quotes;
    CREATE TRIGGER update_fronttervezo_quotes_updated_at
      BEFORE UPDATE ON public.fronttervezo_quotes
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Status timestamps (nincs in_production)
CREATE OR REPLACE FUNCTION public.update_fronttervezo_quote_status_timestamps()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'ordered' THEN
        IF NEW.ordered_at IS NULL THEN
          NEW.ordered_at := NOW();
        END IF;
      WHEN 'ready' THEN
        IF NEW.ready_at IS NULL THEN
          NEW.ready_at := NOW();
        END IF;
      WHEN 'finished' THEN
        IF NEW.finished_at IS NULL THEN
          NEW.finished_at := NOW();
        END IF;
      WHEN 'cancelled' THEN
        IF NEW.cancelled_at IS NULL THEN
          NEW.cancelled_at := NOW();
        END IF;
      ELSE
        NULL;
    END CASE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_fronttervezo_quote_status_timestamps ON public.fronttervezo_quotes;
CREATE TRIGGER trigger_update_fronttervezo_quote_status_timestamps
  BEFORE UPDATE ON public.fronttervezo_quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_fronttervezo_quote_status_timestamps();

-- -----------------------------------------------------
-- 2) Lines: minden front panel külön sor
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fronttervezo_quote_lines (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL,
  front_type text NOT NULL
    CHECK (front_type IN ('inomat', 'festett', 'folias', 'alu', 'akril')),
  nettfront_sku_id uuid NULL,

  -- Snapshot a mentés pillanatában
  sku_code text NOT NULL,
  display_name text NOT NULL,
  finish text
    CHECK (finish IS NULL OR finish IN ('matt', 'hg')),
  swatch_hex text NULL,
  cost_net_per_sqm numeric(12, 2) NOT NULL DEFAULT 0,
  sell_net_per_sqm numeric(12, 2) NOT NULL DEFAULT 0,
  vat_percent numeric(5, 2) NOT NULL DEFAULT 27,

  height_mm integer NOT NULL CHECK (height_mm > 0),
  width_mm integer NOT NULL CHECK (width_mm > 0),
  quantity integer NOT NULL CHECK (quantity > 0),
  area_sqm numeric(14, 6) NOT NULL DEFAULT 0,

  line_net numeric(12, 2) NOT NULL DEFAULT 0,
  line_vat numeric(12, 2) NOT NULL DEFAULT 0,
  line_gross numeric(12, 2) NOT NULL DEFAULT 0,

  -- pl. { "oldal": "hosszu", "mennyiseg": 3, "tavolsagokAlulMm": [100, 400, 700] }
  panthely jsonb NULL,
  panthely_holes_total integer NOT NULL DEFAULT 0 CHECK (panthely_holes_total >= 0),

  megjegyzes text NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fronttervezo_quote_lines_pkey PRIMARY KEY (id),
  CONSTRAINT fronttervezo_quote_lines_quote_id_fkey
    FOREIGN KEY (quote_id) REFERENCES public.fronttervezo_quotes (id) ON DELETE CASCADE,
  CONSTRAINT fronttervezo_quote_lines_nettfront_sku_id_fkey
    FOREIGN KEY (nettfront_sku_id) REFERENCES public.nettfront_skus (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_fronttervezo_quote_lines_quote_id
  ON public.fronttervezo_quote_lines (quote_id);

CREATE INDEX IF NOT EXISTS idx_fronttervezo_quote_lines_sku
  ON public.fronttervezo_quote_lines (nettfront_sku_id);

CREATE INDEX IF NOT EXISTS idx_fronttervezo_quote_lines_front_type
  ON public.fronttervezo_quote_lines (front_type);

-- -----------------------------------------------------
-- 3) SKU / szín összesítő (detail UI rollup)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fronttervezo_quote_sku_summary (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL,
  front_type text NOT NULL
    CHECK (front_type IN ('inomat', 'festett', 'folias', 'alu', 'akril')),
  nettfront_sku_id uuid NULL,
  sku_code text NOT NULL,
  display_name text NOT NULL,
  finish text
    CHECK (finish IS NULL OR finish IN ('matt', 'hg')),
  panels_db integer NOT NULL DEFAULT 0,
  total_sqm numeric(14, 6) NOT NULL DEFAULT 0,
  sell_net_per_sqm numeric(12, 2) NOT NULL DEFAULT 0,
  cost_net_total numeric(12, 2) NOT NULL DEFAULT 0,
  net numeric(12, 2) NOT NULL DEFAULT 0,
  vat numeric(12, 2) NOT NULL DEFAULT 0,
  gross numeric(12, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fronttervezo_quote_sku_summary_pkey PRIMARY KEY (id),
  CONSTRAINT fronttervezo_quote_sku_summary_quote_id_fkey
    FOREIGN KEY (quote_id) REFERENCES public.fronttervezo_quotes (id) ON DELETE CASCADE,
  CONSTRAINT fronttervezo_quote_sku_summary_sku_id_fkey
    FOREIGN KEY (nettfront_sku_id) REFERENCES public.nettfront_skus (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_fronttervezo_quote_sku_summary_quote_id
  ON public.fronttervezo_quote_sku_summary (quote_id);

-- -----------------------------------------------------
-- 4) Szolgáltatások (pánthelyfúrás stb.)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fronttervezo_quote_services (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL,
  service_type text NOT NULL
    CHECK (service_type IN ('panthelyfuras')),
  quantity numeric(12, 2) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit_price_net numeric(12, 2) NOT NULL DEFAULT 0,
  vat_percent numeric(5, 2) NOT NULL DEFAULT 27,
  net numeric(12, 2) NOT NULL DEFAULT 0,
  vat numeric(12, 2) NOT NULL DEFAULT 0,
  gross numeric(12, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fronttervezo_quote_services_pkey PRIMARY KEY (id),
  CONSTRAINT fronttervezo_quote_services_quote_id_fkey
    FOREIGN KEY (quote_id) REFERENCES public.fronttervezo_quotes (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fronttervezo_quote_services_quote_id
  ON public.fronttervezo_quote_services (quote_id);

-- -----------------------------------------------------
-- 5) Díjak
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fronttervezo_quote_fees (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL,
  feetype_id uuid NOT NULL,
  fee_name character varying(255) NOT NULL,
  unit_price_net numeric(12, 2) NOT NULL,
  vat_rate numeric(5, 4) NOT NULL,
  vat_amount numeric(12, 2) NOT NULL,
  gross_price numeric(12, 2) NOT NULL,
  currency_id uuid NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  comment text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,

  CONSTRAINT fronttervezo_quote_fees_pkey PRIMARY KEY (id),
  CONSTRAINT fronttervezo_quote_fees_quote_id_fkey
    FOREIGN KEY (quote_id) REFERENCES public.fronttervezo_quotes (id) ON DELETE CASCADE,
  CONSTRAINT fronttervezo_quote_fees_feetype_id_fkey
    FOREIGN KEY (feetype_id) REFERENCES public.feetypes (id) ON DELETE RESTRICT,
  CONSTRAINT fronttervezo_quote_fees_currency_id_fkey
    FOREIGN KEY (currency_id) REFERENCES public.currencies (id)
);

CREATE INDEX IF NOT EXISTS idx_fronttervezo_quote_fees_quote_id
  ON public.fronttervezo_quote_fees (quote_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_fronttervezo_quote_fees_feetype_id
  ON public.fronttervezo_quote_fees (feetype_id);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    DROP TRIGGER IF EXISTS update_fronttervezo_quote_fees_updated_at ON public.fronttervezo_quote_fees;
    CREATE TRIGGER update_fronttervezo_quote_fees_updated_at
      BEFORE UPDATE ON public.fronttervezo_quote_fees
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- -----------------------------------------------------
-- 6) Fizetések
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fronttervezo_quote_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL,
  amount numeric(12, 2) NOT NULL,
  payment_method text NOT NULL
    CHECK (payment_method IN ('cash', 'transfer', 'card')),
  comment text NULL,
  payment_date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  deleted_at timestamptz NULL,

  CONSTRAINT fronttervezo_quote_payments_pkey PRIMARY KEY (id),
  CONSTRAINT fronttervezo_quote_payments_quote_id_fkey
    FOREIGN KEY (quote_id) REFERENCES public.fronttervezo_quotes (id) ON DELETE CASCADE,
  CONSTRAINT fronttervezo_quote_payments_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users (id)
);

CREATE INDEX IF NOT EXISTS idx_fronttervezo_quote_payments_quote_id
  ON public.fronttervezo_quote_payments (quote_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_fronttervezo_quote_payments_payment_date
  ON public.fronttervezo_quote_payments (payment_date DESC)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.fronttervezo_quote_payments.amount IS
  'Positive = payment, negative = refund';

CREATE OR REPLACE FUNCTION public.update_fronttervezo_quote_payment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_quote_id uuid;
  v_final_total numeric(12, 2);
  v_total_paid numeric(12, 2);
  v_new_status text;
  v_tolerance constant numeric := 1.0;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    v_quote_id := OLD.quote_id;
  ELSE
    v_quote_id := NEW.quote_id;
  END IF;

  SELECT final_total_after_discount INTO v_final_total
  FROM public.fronttervezo_quotes
  WHERE id = v_quote_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
  FROM public.fronttervezo_quote_payments
  WHERE quote_id = v_quote_id
    AND deleted_at IS NULL;

  IF v_total_paid = 0 THEN
    v_new_status := 'not_paid';
  ELSIF v_total_paid >= v_final_total - v_tolerance THEN
    v_new_status := 'paid';
  ELSE
    v_new_status := 'partial';
  END IF;

  UPDATE public.fronttervezo_quotes
  SET payment_status = v_new_status,
      updated_at = NOW()
  WHERE id = v_quote_id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_ft_quote_payment_status_insert ON public.fronttervezo_quote_payments;
DROP TRIGGER IF EXISTS trigger_ft_quote_payment_status_update ON public.fronttervezo_quote_payments;
DROP TRIGGER IF EXISTS trigger_ft_quote_payment_status_delete ON public.fronttervezo_quote_payments;

CREATE TRIGGER trigger_ft_quote_payment_status_insert
  AFTER INSERT ON public.fronttervezo_quote_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_fronttervezo_quote_payment_status();

CREATE TRIGGER trigger_ft_quote_payment_status_update
  AFTER UPDATE ON public.fronttervezo_quote_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_fronttervezo_quote_payment_status();

CREATE TRIGGER trigger_ft_quote_payment_status_delete
  AFTER DELETE ON public.fronttervezo_quote_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_fronttervezo_quote_payment_status();

-- -----------------------------------------------------
-- 7) Number + barcode generators
-- -----------------------------------------------------

-- FQ-YYYY-NNN
CREATE OR REPLACE FUNCTION public.generate_fronttervezo_quote_number()
RETURNS character varying
LANGUAGE plpgsql
AS $$
DECLARE
  current_year integer;
  next_number integer;
  new_quote_number varchar(50);
  max_attempts integer := 100;
  attempt integer := 0;
BEGIN
  current_year := EXTRACT(YEAR FROM NOW());

  SELECT COALESCE(MAX(
    CAST(SUBSTRING(quote_number FROM LENGTH('FQ-' || current_year::text || '-') + 1) AS integer)
  ), 0) + 1
  INTO next_number
  FROM public.fronttervezo_quotes
  WHERE quote_number LIKE 'FQ-' || current_year::text || '-%';

  LOOP
    new_quote_number := 'FQ-' || current_year::text || '-' || LPAD(next_number::text, 3, '0');

    IF NOT EXISTS (
      SELECT 1 FROM public.fronttervezo_quotes WHERE quote_number = new_quote_number
    ) THEN
      RETURN new_quote_number;
    END IF;

    next_number := next_number + 1;
    attempt := attempt + 1;

    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique fronttervezo quote number after % attempts', max_attempts;
    END IF;
  END LOOP;
END;
$$;

-- FORD-YYYY-MM-DD-NNN
CREATE OR REPLACE FUNCTION public.generate_fronttervezo_order_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  date_str text;
  next_num integer;
  new_order_number text;
  max_attempts integer := 100;
  attempt integer := 0;
BEGIN
  date_str := TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD');

  SELECT COALESCE(MAX(
    CAST(SUBSTRING(order_number FROM LENGTH('FORD-' || date_str || '-') + 1) AS integer)
  ), 0) + 1
  INTO next_num
  FROM public.fronttervezo_quotes
  WHERE order_number LIKE 'FORD-' || date_str || '-%';

  LOOP
    new_order_number := 'FORD-' || date_str || '-' || LPAD(next_num::text, 3, '0');

    IF NOT EXISTS (
      SELECT 1 FROM public.fronttervezo_quotes WHERE order_number = new_order_number
    ) THEN
      RETURN new_order_number;
    END IF;

    next_num := next_num + 1;
    attempt := attempt + 1;

    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique fronttervezo order number after % attempts', max_attempts;
    END IF;
  END LOOP;
END;
$$;

-- EAN-13 — uniqueness vs quotes + worktop_quotes + fronttervezo_quotes
CREATE OR REPLACE FUNCTION public.generate_fronttervezo_order_barcode()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  new_barcode text;
  barcode_exists boolean;
  max_attempts integer := 100;
  attempts integer := 0;
  sum_val integer;
  digit integer;
  i integer;
BEGIN
  LOOP
    attempts := attempts + 1;
    new_barcode := '';

    FOR i IN 1..12 LOOP
      new_barcode := new_barcode || floor(random() * 10)::text;
    END LOOP;

    sum_val := 0;
    FOR i IN 1..12 LOOP
      digit := substring(new_barcode, i, 1)::integer;
      IF i % 2 = 1 THEN
        sum_val := sum_val + digit;
      ELSE
        sum_val := sum_val + (digit * 3);
      END IF;
    END LOOP;

    new_barcode := new_barcode || ((10 - (sum_val % 10)) % 10)::text;

    SELECT EXISTS(
      SELECT 1 FROM public.fronttervezo_quotes
      WHERE barcode = new_barcode AND deleted_at IS NULL
    ) INTO barcode_exists;

    IF NOT barcode_exists AND EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'quotes'
    ) THEN
      SELECT EXISTS(
        SELECT 1 FROM public.quotes
        WHERE barcode = new_barcode AND deleted_at IS NULL
      ) INTO barcode_exists;
    END IF;

    IF NOT barcode_exists AND EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'worktop_quotes'
    ) THEN
      SELECT EXISTS(
        SELECT 1 FROM public.worktop_quotes
        WHERE barcode = new_barcode AND deleted_at IS NULL
      ) INTO barcode_exists;
    END IF;

    IF NOT barcode_exists THEN
      RETURN new_barcode;
    END IF;

    IF attempts >= max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique fronttervezo barcode after % attempts', max_attempts;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON TABLE public.fronttervezo_quotes IS
  'Nettfront / Fronttervező ajánlatok és megrendelések (egy sor = quote+order)';
COMMENT ON TABLE public.fronttervezo_quote_lines IS
  'Egy sor = egy front panel (szín, méret, db, pánthely snapshot)';
COMMENT ON TABLE public.fronttervezo_quote_sku_summary IS
  'SKU/szín szerinti árazási összesítő a detail UI-hoz';
COMMENT ON TABLE public.fronttervezo_quote_services IS
  'Quote-szintű szolgáltatások (pl. pánthelyfúrás összesített lyuk)';
COMMENT ON FUNCTION public.generate_fronttervezo_quote_number() IS
  'FQ-YYYY-NNN';
COMMENT ON FUNCTION public.generate_fronttervezo_order_number() IS
  'FORD-YYYY-MM-DD-NNN';
COMMENT ON FUNCTION public.generate_fronttervezo_order_barcode() IS
  'EAN-13, unique vs fronttervezo_quotes + quotes + worktop_quotes';
