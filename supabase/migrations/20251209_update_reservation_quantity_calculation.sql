-- ============================================
-- Update manage_customer_order_item_reservation to calculate reservation quantity based on product type
-- ============================================
-- 
-- For linear_materials: customer_order_items.quantity * linear_material.length / 1000 (convert mm to meters)
-- For materials: customer_order_items.quantity * length_mm * width_mm / 1000000 (convert mm² to m²)
-- For accessories: customer_order_items.quantity (no conversion)
--

CREATE OR REPLACE FUNCTION manage_customer_order_item_reservation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_warehouse_id uuid;
  v_reservation_movement_id uuid;
  v_calculated_quantity numeric(10,2);
  v_material_length_mm numeric(10,2);
  v_material_width_mm numeric(10,2);
  v_linear_material_length numeric(10,2);
BEGIN
  -- Only process product items with FKs
  IF NEW.item_type != 'product' OR 
     (NEW.accessory_id IS NULL AND NEW.material_id IS NULL AND NEW.linear_material_id IS NULL) THEN
    RETURN NEW;
  END IF;

  -- Status changed TO 'arrived': Create reservation
  IF NEW.status = 'arrived' AND (OLD.status IS NULL OR OLD.status != 'arrived') THEN
    -- Get warehouse from reservation_warehouse_id (set by receive_shipment)
    v_warehouse_id := NEW.reservation_warehouse_id;
    
    IF v_warehouse_id IS NULL THEN
      -- Fallback: Get default active warehouse
      SELECT id INTO v_warehouse_id
      FROM public.warehouses
      WHERE is_active = true
      ORDER BY created_at
      LIMIT 1;
    END IF;
    
    IF v_warehouse_id IS NULL THEN
      RAISE WARNING 'No warehouse found for reservation on customer_order_item %', NEW.id;
      RETURN NEW;
    END IF;
    
    -- Calculate quantity based on product type
    IF NEW.product_type = 'linear_material' AND NEW.linear_material_id IS NOT NULL THEN
      -- Get length from linear_materials
      SELECT length INTO v_linear_material_length
      FROM public.linear_materials
      WHERE id = NEW.linear_material_id
        AND deleted_at IS NULL;
      
      IF v_linear_material_length IS NOT NULL THEN
        -- For linear_materials: quantity * length / 1000 (convert mm to meters)
        v_calculated_quantity := NEW.quantity * v_linear_material_length / 1000::numeric;
      ELSE
        -- Fallback to original quantity if length not found
        v_calculated_quantity := NEW.quantity;
      END IF;
    ELSIF NEW.product_type = 'material' AND NEW.material_id IS NOT NULL THEN
      -- Get dimensions from materials
      SELECT length_mm, width_mm INTO v_material_length_mm, v_material_width_mm
      FROM public.materials
      WHERE id = NEW.material_id
        AND deleted_at IS NULL;
      
      IF v_material_length_mm IS NOT NULL AND v_material_width_mm IS NOT NULL THEN
        -- For materials: quantity * length_mm * width_mm / 1000000 (convert mm² to m²)
        v_calculated_quantity := NEW.quantity * v_material_length_mm * v_material_width_mm / 1000000::numeric;
      ELSE
        -- Fallback to original quantity if dimensions not found
        v_calculated_quantity := NEW.quantity;
      END IF;
    ELSE
      -- For accessories or unknown types: use quantity as-is
      v_calculated_quantity := NEW.quantity;
    END IF;
    
    -- Check if reservation already exists (prevent duplicates)
    SELECT id INTO v_reservation_movement_id
    FROM public.stock_movements
    WHERE source_type = 'customer_order_reservation'
      AND source_id = NEW.id;
    
    IF v_reservation_movement_id IS NULL THEN
      -- Create reservation stock movement (OUT - negative quantity)
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
        v_warehouse_id,
        NEW.product_type,
        NEW.accessory_id,
        NEW.material_id,
        NEW.linear_material_id,
        -1 * v_calculated_quantity,  -- Negative for OUT, using calculated quantity
        'out',
        'customer_order_reservation',
        NEW.id,
        'Customer order reservation: ' || (SELECT order_number FROM public.customer_orders WHERE id = NEW.order_id),
        generate_stock_movement_number()
      );
    END IF;
  END IF;

  -- Status changed FROM 'arrived' to something else: Delete reservation
  IF (OLD.status = 'arrived' AND NEW.status != 'arrived') OR 
     (OLD.status = 'arrived' AND NEW.status = 'handed_over') THEN
    -- Delete the reservation movement (hard delete since stock_movements doesn't have deleted_at)
    DELETE FROM public.stock_movements
    WHERE source_type = 'customer_order_reservation'
      AND source_id = OLD.id;
    
    -- Clear reservation_warehouse_id
    NEW.reservation_warehouse_id := NULL;
  END IF;

  RETURN NEW;
END;
$$;

