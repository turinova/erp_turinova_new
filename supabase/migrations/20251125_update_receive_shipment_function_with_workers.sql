-- Drop the old function if it exists (to avoid signature conflicts)
DROP FUNCTION IF EXISTS public.receive_shipment(uuid);

-- Create updated receive_shipment function to accept and save worker IDs
CREATE FUNCTION public.receive_shipment(
  p_shipment_id uuid,
  p_worker_ids uuid[] DEFAULT ARRAY[]::uuid[]
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_shipment record;
  v_po record;
  v_item record;
  v_received_count integer := 0;
  v_total_items integer := 0;
  v_all_received boolean := true;
  v_po_item record;
  v_received_qty numeric(10,2);
  v_ordered_qty numeric(10,2);
  v_worker_id uuid;
  v_received_at timestamp with time zone := now();
BEGIN
  -- Validate shipment exists and is in draft status
  SELECT s.*, po.id as po_id, po.status as po_status
  INTO v_shipment
  FROM public.shipments s
  INNER JOIN public.purchase_orders po ON po.id = s.purchase_order_id
  WHERE s.id = p_shipment_id
    AND s.deleted_at IS NULL
    AND po.deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Shipment not found or deleted'
    );
  END IF;

  IF v_shipment.status != 'draft' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Shipment can only be received from draft status'
    );
  END IF;

  -- Validate that at least one worker is provided
  IF array_length(p_worker_ids, 1) IS NULL OR array_length(p_worker_ids, 1) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'At least one worker must be selected'
    );
  END IF;

  -- Load purchase order
  SELECT * INTO v_po
  FROM public.purchase_orders
  WHERE id = v_shipment.purchase_order_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Purchase order not found'
    );
  END IF;

  -- Check if any items have quantity_received > 0
  SELECT COUNT(*) INTO v_received_count
  FROM public.shipment_items si
  WHERE si.shipment_id = p_shipment_id
    AND si.deleted_at IS NULL
    AND si.quantity_received > 0;

  IF v_received_count = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No received quantities provided'
    );
  END IF;

  -- Process each shipment item and create stock movements
  FOR v_item IN
    SELECT 
      si.id,
      si.purchase_order_item_id,
      si.quantity_received,
      poi.product_type,
      poi.accessory_id,
      poi.material_id,
      poi.linear_material_id
    FROM public.shipment_items si
    INNER JOIN public.purchase_order_items poi ON poi.id = si.purchase_order_item_id
    WHERE si.shipment_id = p_shipment_id
      AND si.deleted_at IS NULL
      AND poi.deleted_at IS NULL
      AND si.quantity_received > 0
  LOOP
    -- Insert stock movement
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
      note,
      stock_movement_number
    ) VALUES (
      v_shipment.warehouse_id,
      v_item.product_type,
      v_item.accessory_id,
      v_item.material_id,
      v_item.linear_material_id,
      v_item.quantity_received, -- positive quantity
      'in',
      'purchase_receipt',
      p_shipment_id,
      v_shipment.note,
      generate_stock_movement_number()
    );
  END LOOP;

  -- Insert worker records for this shipment receipt
  FOREACH v_worker_id IN ARRAY p_worker_ids
  LOOP
    INSERT INTO public.shipment_receipt_workers (
      shipment_id,
      worker_id,
      received_at
    ) VALUES (
      p_shipment_id,
      v_worker_id,
      v_received_at
    )
    ON CONFLICT (shipment_id, worker_id) DO NOTHING; -- Prevent duplicates
  END LOOP;

  -- Update shipment status to 'received'
  UPDATE public.shipments
  SET status = 'received',
      updated_at = now()
  WHERE id = p_shipment_id;

  -- Recalculate PO status based on ALL shipments for this PO
  -- For each PO item, sum received quantities across all shipments
  FOR v_po_item IN
    SELECT poi.id, poi.quantity as ordered_qty
    FROM public.purchase_order_items poi
    WHERE poi.purchase_order_id = v_po.id
      AND poi.deleted_at IS NULL
  LOOP
    -- Sum received quantities from all shipments for this PO item
    SELECT COALESCE(SUM(si.quantity_received), 0) INTO v_received_qty
    FROM public.shipment_items si
    INNER JOIN public.shipments s ON s.id = si.shipment_id
    WHERE si.purchase_order_item_id = v_po_item.id
      AND s.purchase_order_id = v_po.id
      AND si.deleted_at IS NULL
      AND s.deleted_at IS NULL
      AND s.status = 'received';

    v_ordered_qty := v_po_item.ordered_qty;

    -- If any item is not fully received, PO is partial
    IF v_received_qty < v_ordered_qty THEN
      v_all_received := false;
      EXIT; -- Exit loop early
    END IF;
  END LOOP;

  -- Update PO status
  IF v_all_received THEN
    UPDATE public.purchase_orders
    SET status = 'received',
        updated_at = now()
    WHERE id = v_po.id;
  ELSE
    UPDATE public.purchase_orders
    SET status = 'partial',
        updated_at = now()
    WHERE id = v_po.id;
  END IF;

  -- Return success response
  RETURN jsonb_build_object(
    'success', true,
    'shipment_id', p_shipment_id,
    'shipment_status', 'received',
    'po_status', CASE WHEN v_all_received THEN 'received' ELSE 'partial' END,
    'items_received', v_received_count
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Rollback is automatic in a function
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

