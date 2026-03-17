-- Pick batches (Begyűjtések) for batch picking workflow
-- Links orders to a batch; start batch -> orders go to picking; complete -> picked; cancel -> back to new

CREATE SEQUENCE IF NOT EXISTS pick_batch_number_seq
  INCREMENT BY 1
  MINVALUE 1
  NO MAXVALUE
  START WITH 1
  OWNED BY NONE;

CREATE OR REPLACE FUNCTION generate_pick_batch_code()
RETURNS VARCHAR
LANGUAGE plpgsql
AS $$
DECLARE
  next_val BIGINT;
BEGIN
  SELECT nextval('pick_batch_number_seq') INTO next_val;
  RETURN 'BGY-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(next_val::TEXT, 4, '0');
END;
$$;

CREATE TABLE IF NOT EXISTS public.pick_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL DEFAULT generate_pick_batch_code(),
  name TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'in_progress', 'completed', 'cancelled')
  ),
  created_by UUID REFERENCES public.users(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pick_batch_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_batch_id UUID NOT NULL REFERENCES public.pick_batches(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pick_batch_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_pick_batches_status ON public.pick_batches(status);
CREATE INDEX IF NOT EXISTS idx_pick_batches_created_at ON public.pick_batches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pick_batch_orders_batch ON public.pick_batch_orders(pick_batch_id);
CREATE INDEX IF NOT EXISTS idx_pick_batch_orders_order ON public.pick_batch_orders(order_id);

DROP TRIGGER IF EXISTS update_pick_batches_updated_at ON public.pick_batches;
CREATE TRIGGER update_pick_batches_updated_at
  BEFORE UPDATE ON public.pick_batches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.pick_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pick_batch_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pick batches viewable by authenticated" ON public.pick_batches;
CREATE POLICY "Pick batches viewable by authenticated" ON public.pick_batches FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Pick batches manageable by authenticated" ON public.pick_batches;
CREATE POLICY "Pick batches manageable by authenticated" ON public.pick_batches FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Pick batch orders viewable by authenticated" ON public.pick_batch_orders;
CREATE POLICY "Pick batch orders viewable by authenticated" ON public.pick_batch_orders FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Pick batch orders manageable by authenticated" ON public.pick_batch_orders;
CREATE POLICY "Pick batch orders manageable by authenticated" ON public.pick_batch_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pick_batches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pick_batch_orders TO authenticated;

COMMENT ON TABLE public.pick_batches IS 'Begyűjtések - batch picking batches';
COMMENT ON TABLE public.pick_batch_orders IS 'Orders linked to a pick batch';
