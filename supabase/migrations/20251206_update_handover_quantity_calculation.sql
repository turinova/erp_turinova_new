-- ============================================
-- Update hand_over_customer_order to calculate stock movement quantities based on product type
-- ============================================
-- 
-- For linear_materials: quantity * length / 1000 (convert mm to meters)
-- For materials: quantity * length_mm * width_mm / 1000000 (convert mm² to m²)
-- For accessories: quantity (no conversion)
--

-- Drop and recreate the function with quantity calculation
CREATE OR REPLACE FUNCTION hand_over_customer_order(
  p_customer_order_id uuid,
  p_warehouse_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_customer_order public.customer_orders%ROWTYPE;
  v_warehouse_id uuid;
  v_stock_movements_created integer := 0;
  v_item record;
BEGIN
  -- 1. Validate customer_order exists and is in 'finished' or 'arrived' status
  SELECT * INTO v_customer_order
  FROM public.customer_orders
  WHERE id = p_customer_order_id
    AND deleted_at IS NULL;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Customer order not found');
  END IF;
  
  IF v_customer_order.status NOT IN ('finished', 'arrived') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Customer order must be in finished or arrived status');
  END IF;
  
  -- 2. Determine warehouse
  IF p_warehouse_id IS NOT NULL THEN
    v_warehouse_id := p_warehouse_id;
  ELSE
    SELECT id INTO v_warehouse_id
    FROM public.warehouses
    WHERE is_active = true
    ORDER BY created_at
    LIMIT 1;
    
    IF v_warehouse_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'No active warehouse found');
    END IF;
  END IF;
  
  -- 3. Update customer_order status to 'handed_over'
  UPDATE public.customer_orders
  SET status = 'handed_over',
      updated_at = NOW()
  WHERE id = p_customer_order_id;
  
  -- 4. Update all product items to 'handed_over' (fees don't have status)
  -- This will trigger the reservation deletion via the trigger
  UPDATE public.customer_order_items
  SET status = 'handed_over',
      updated_at = NOW()
  WHERE order_id = p_customer_order_id
    AND deleted_at IS NULL
    AND item_type = 'product'
    AND status != 'handed_over';
  
  -- 5. Create stock movements (OUT) for all product items with FKs
  -- Use reservation_warehouse_id if available, otherwise use default warehouse
  -- Calculate quantity based on product type:
  -- - linear_materials: quantity * length / 1000 (mm to meters)
  -- - materials: quantity * length_mm * width_mm / 1000000 (mm² to m²)
  -- - accessories: quantity (no conversion)
  FOR v_item IN
    SELECT 
      coi.id,
      coi.quantity,
      coi.accessory_id,
      coi.material_id,
      coi.linear_material_id,
      coi.product_type,
      COALESCE(coi.reservation_warehouse_id, v_warehouse_id) as item_warehouse_id,
      -- Calculate quantity based on product type
      CASE 
        WHEN coi.product_type = 'linear_material' AND lm.length IS NOT NULL THEN
          coi.quantity * lm.length / 1000::numeric
        WHEN coi.product_type = 'material' AND m.length_mm IS NOT NULL AND m.width_mm IS NOT NULL THEN
          coi.quantity * m.length_mm * m.width_mm / 1000000::numeric
        ELSE
          coi.quantity  -- Accessories or fallback
      END AS calculated_quantity
    FROM public.customer_order_items coi
    LEFT JOIN public.materials m ON m.id = coi.material_id AND m.deleted_at IS NULL
    LEFT JOIN public.linear_materials lm ON lm.id = coi.linear_material_id AND lm.deleted_at IS NULL
    WHERE coi.order_id = p_customer_order_id
      AND coi.deleted_at IS NULL
      AND coi.item_type = 'product'
      AND (coi.accessory_id IS NOT NULL 
        OR coi.material_id IS NOT NULL 
        OR coi.linear_material_id IS NOT NULL)
  LOOP
    -- Create stock movement (OUT) with calculated quantity
    -- Use reservation_warehouse_id if available, otherwise use default
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
      v_item.item_warehouse_id,
      v_item.product_type,
      v_item.accessory_id,
      v_item.material_id,
      v_item.linear_material_id,
      -1 * v_item.calculated_quantity,  -- Use calculated quantity instead of quantity (negative for OUT)
      'out',
      'customer_order_handover',
      p_customer_order_id,
      'Customer order handover: ' || v_customer_order.order_number,
      generate_stock_movement_number()
    );
    
    v_stock_movements_created := v_stock_movements_created + 1;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'customer_order_id', p_customer_order_id,
    'customer_order_status', 'handed_over',
    'stock_movements_created', v_stock_movements_created
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION hand_over_customer_order(uuid, uuid) IS 
  'Hands over a customer order. Now uses reservation_warehouse_id for stock movements and calculates quantities based on product type (linear_materials: mm to meters, materials: mm² to m², accessories: no conversion). Reservations are automatically deleted by trigger when status changes to "handed_over".';

