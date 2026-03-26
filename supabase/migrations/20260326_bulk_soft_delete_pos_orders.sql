-- Bulk soft delete POS orders with stock rollback
-- Rules:
-- - Block deletion when active invoice exists
-- - Soft delete order, items, payments
-- - Insert reverse stock movements for product items

DO $$
BEGIN
  ALTER TABLE public.stock_movements
    DROP CONSTRAINT IF EXISTS stock_movements_source_type_check;

  ALTER TABLE public.stock_movements
    ADD CONSTRAINT stock_movements_source_type_check
    CHECK (source_type IN (
      'purchase_receipt',
      'pos_sale',
      'adjustment',
      'customer_order_handover',
      'customer_order_reservation',
      'quote',
      'quote_reservation',
      'pos_order_delete'
    ));
END $$;

CREATE OR REPLACE FUNCTION public.bulk_soft_delete_pos_orders(
  p_order_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_order_id uuid;
  v_order RECORD;
  v_item RECORD;
  v_warehouse_id uuid;
  v_has_active_invoice boolean;
  v_deleted_count integer := 0;
  v_blocked_count integer := 0;
  v_already_deleted_count integer := 0;
  v_not_found_count integer := 0;
  v_blocked_ids uuid[] := '{}';
  v_deleted_ids uuid[] := '{}';
  v_already_deleted_ids uuid[] := '{}';
  v_not_found_ids uuid[] := '{}';
BEGIN
  IF p_order_ids IS NULL OR array_length(p_order_ids, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Nincs kijelolt rendelés'
    );
  END IF;

  FOR v_order_id IN SELECT unnest(p_order_ids)
  LOOP
    SELECT id, pos_order_number, deleted_at
      INTO v_order
    FROM public.pos_orders
    WHERE id = v_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
      v_not_found_count := v_not_found_count + 1;
      v_not_found_ids := array_append(v_not_found_ids, v_order_id);
      CONTINUE;
    END IF;

    IF v_order.deleted_at IS NOT NULL THEN
      v_already_deleted_count := v_already_deleted_count + 1;
      v_already_deleted_ids := array_append(v_already_deleted_ids, v_order_id);
      CONTINUE;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.invoices i
      WHERE i.related_order_type = 'pos_order'
        AND i.related_order_id = v_order_id
        AND i.deleted_at IS NULL
    )
    INTO v_has_active_invoice;

    IF v_has_active_invoice THEN
      v_blocked_count := v_blocked_count + 1;
      v_blocked_ids := array_append(v_blocked_ids, v_order_id);
      CONTINUE;
    END IF;

    -- Reverse stock for all active product items.
    FOR v_item IN
      SELECT
        item_type,
        product_type,
        accessory_id,
        material_id,
        linear_material_id,
        quantity
      FROM public.pos_order_items
      WHERE pos_order_id = v_order_id
        AND deleted_at IS NULL
        AND item_type = 'product'
    LOOP
      SELECT sm.warehouse_id
        INTO v_warehouse_id
      FROM public.stock_movements sm
      WHERE sm.source_type = 'pos_sale'
        AND sm.source_id = v_order_id
        AND sm.product_type = v_item.product_type
      ORDER BY sm.created_at DESC
      LIMIT 1;

      IF v_warehouse_id IS NULL THEN
        SELECT w.id
          INTO v_warehouse_id
        FROM public.warehouses w
        WHERE w.is_active = true
        LIMIT 1;
      END IF;

      IF v_warehouse_id IS NOT NULL THEN
        INSERT INTO public.stock_movements (
          warehouse_id,
          product_type,
          accessory_id,
          material_id,
          linear_material_id,
          quantity,
          movement_type,
          source_type,
          source_id,
          note
        ) VALUES (
          v_warehouse_id,
          v_item.product_type,
          v_item.accessory_id,
          v_item.material_id,
          v_item.linear_material_id,
          ABS(COALESCE(v_item.quantity, 0)),
          'in',
          'pos_order_delete',
          v_order_id,
          'POS torles visszavetelezes: ' || COALESCE(v_order.pos_order_number, v_order_id::text)
        );
      END IF;
    END LOOP;

    UPDATE public.pos_order_items
    SET deleted_at = now(), updated_at = now()
    WHERE pos_order_id = v_order_id
      AND deleted_at IS NULL;

    UPDATE public.pos_payments
    SET deleted_at = now(), updated_at = now()
    WHERE pos_order_id = v_order_id
      AND deleted_at IS NULL;

    UPDATE public.pos_orders
    SET status = 'cancelled', deleted_at = now(), updated_at = now()
    WHERE id = v_order_id;

    v_deleted_count := v_deleted_count + 1;
    v_deleted_ids := array_append(v_deleted_ids, v_order_id);
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_count', v_deleted_count,
    'blocked_count', v_blocked_count,
    'already_deleted_count', v_already_deleted_count,
    'not_found_count', v_not_found_count,
    'deleted_ids', v_deleted_ids,
    'blocked_ids', v_blocked_ids,
    'already_deleted_ids', v_already_deleted_ids,
    'not_found_ids', v_not_found_ids
  );
END;
$$;

