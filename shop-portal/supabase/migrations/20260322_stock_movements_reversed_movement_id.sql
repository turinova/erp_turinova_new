-- Pair each 'released' row with the 'reserved' row it cancels (immutable ledger).
-- Without this, every release sees ALL historical reserved rows and duplicates Felszabadított lines.

ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS reversed_movement_id UUID REFERENCES public.stock_movements(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stock_movements_reversed_movement_id
  ON public.stock_movements(reversed_movement_id)
  WHERE reversed_movement_id IS NOT NULL;

COMMENT ON COLUMN public.stock_movements.reversed_movement_id IS
  'For movement_type=released: the reserved stock_movements.id row this release cancels. Prevents double-releasing the same reserved row.';

-- Backfill: pair legacy released rows (order source) to oldest still-unpaired matching reserved row (FIFO).
DO $$
DECLARE
  rel_rec RECORD;
  res_id UUID;
BEGIN
  FOR rel_rec IN
    SELECT id, source_id, warehouse_id, product_id, quantity, created_at
    FROM public.stock_movements
    WHERE movement_type = 'released'
      AND source_type = 'order'
      AND reversed_movement_id IS NULL
    ORDER BY created_at ASC
  LOOP
    SELECT sm.id INTO res_id
    FROM public.stock_movements sm
    WHERE sm.movement_type = 'reserved'
      AND sm.source_type = 'order'
      AND sm.source_id = rel_rec.source_id
      AND sm.warehouse_id = rel_rec.warehouse_id
      AND sm.product_id = rel_rec.product_id
      AND sm.quantity = rel_rec.quantity
      AND sm.created_at <= rel_rec.created_at
      AND NOT EXISTS (
        SELECT 1 FROM public.stock_movements rm
        WHERE rm.movement_type = 'released'
          AND rm.reversed_movement_id = sm.id
      )
    ORDER BY sm.created_at ASC
    LIMIT 1;

    IF res_id IS NOT NULL THEN
      UPDATE public.stock_movements
      SET reversed_movement_id = res_id
      WHERE id = rel_rec.id;
    END IF;
  END LOOP;
END;
$$;
