-- ============================================
-- Customer Order Item Stock Reservation System
-- ============================================
-- This migration implements stock reservations when customer_order_items
-- status changes to 'arrived', preventing other orders from incorrectly
-- showing as 'arrived' when stock is already reserved.

-- ============================================
-- 1. Add reservation_warehouse_id to customer_order_items
-- ============================================
ALTER TABLE public.customer_order_items
  ADD COLUMN IF NOT EXISTS reservation_warehouse_id uuid NULL 
  REFERENCES public.warehouses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customer_order_items_reservation_warehouse_id
  ON public.customer_order_items(reservation_warehouse_id);

-- ============================================
-- 2. Update source_type constraint to include 'customer_order_reservation'
-- ============================================
DO $$
BEGIN
  -- Drop existing constraint if it exists
  ALTER TABLE public.stock_movements 
    DROP CONSTRAINT IF EXISTS stock_movements_source_type_check;
  
  -- Add new constraint with 'customer_order_reservation'
  ALTER TABLE public.stock_movements
    ADD CONSTRAINT stock_movements_source_type_check 
    CHECK (source_type IN (
      'purchase_receipt',
      'pos_sale',
      'adjustment',
      'customer_order_handover',
      'customer_order_reservation'
    ));
EXCEPTION
  WHEN OTHERS THEN
    -- If constraint doesn't exist, create it
    ALTER TABLE public.stock_movements
      ADD CONSTRAINT stock_movements_source_type_check 
      CHECK (source_type IN (
        'purchase_receipt',
        'pos_sale',
        'adjustment',
        'customer_order_handover',
        'customer_order_reservation'
      ));
END $$;

-- ============================================
-- 3. Function to manage customer_order_item reservations
-- ============================================
CREATE OR REPLACE FUNCTION manage_customer_order_item_reservation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_warehouse_id uuid;
  v_reservation_movement_id uuid;
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
        -1 * NEW.quantity,  -- Negative for OUT
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

-- Create trigger
DROP TRIGGER IF EXISTS trigger_manage_customer_order_item_reservation ON public.customer_order_items;
CREATE TRIGGER trigger_manage_customer_order_item_reservation
  AFTER INSERT OR UPDATE OF status ON public.customer_order_items
  FOR EACH ROW
  EXECUTE FUNCTION manage_customer_order_item_reservation();

-- ============================================
-- 4. Update receive_shipment to set reservation_warehouse_id
-- ============================================
CREATE OR REPLACE FUNCTION public.receive_shipment(
  p_shipment_id uuid,
  p_worker_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_shipment record;
  v_po record;
  v_item record;
  v_received_count integer := 0;
  v_all_received boolean := true;
  v_po_item record;
  v_received_qty numeric(10,2);
  v_ordered_qty numeric(10,2);
  v_worker_id uuid;
  v_received_at timestamp with time zone := now();
  v_product_in_shipment record;
  v_customer_item record;
  v_available_stock numeric(10,2);
  v_shipment_warehouse_id uuid;
BEGIN
  -- 1. Validate shipment exists and is in 'draft' status
  SELECT * INTO v_shipment
  FROM public.shipments
  WHERE id = p_shipment_id
    AND deleted_at IS NULL;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Shipment not found');
  END IF;
  
  IF v_shipment.status != 'draft' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Shipment must be in draft status');
  END IF;
  
  -- Validate that at least one worker is provided
  IF array_length(p_worker_ids, 1) IS NULL OR array_length(p_worker_ids, 1) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'At least one worker must be selected');
  END IF;
  
  -- Store shipment warehouse
  v_shipment_warehouse_id := v_shipment.warehouse_id;
  
  -- 2. Get purchase order
  SELECT * INTO v_po
  FROM public.purchase_orders
  WHERE id = v_shipment.purchase_order_id
    AND deleted_at IS NULL;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Purchase order not found');
  END IF;
  
  -- 3. Process shipment items and create stock movements
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
    -- Create stock movement (IN - positive quantity)
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
      v_shipment_warehouse_id,
      v_item.product_type,
      v_item.accessory_id,
      v_item.material_id,
      v_item.linear_material_id,
      v_item.quantity_received,  -- Positive for IN
      'in',
      'purchase_receipt',
      p_shipment_id,
      'Shipment receipt: ' || v_shipment.shipment_number,
      generate_stock_movement_number()
    );
    
    v_received_count := v_received_count + 1;
    
    -- Check if all items for this PO item are received
    -- Get the ordered quantity for this PO item
    SELECT quantity INTO v_ordered_qty
    FROM public.purchase_order_items
    WHERE id = v_item.purchase_order_item_id
      AND deleted_at IS NULL;
    
    -- Get the total received quantity for this PO item across all shipments
    SELECT COALESCE(SUM(quantity_received), 0) INTO v_received_qty
    FROM public.shipment_items
    WHERE purchase_order_item_id = v_item.purchase_order_item_id
      AND deleted_at IS NULL;
    
    IF v_received_qty < v_ordered_qty THEN
      v_all_received := false;
    END IF;
  END LOOP;
  
  -- 4. Update shipment status to 'received'
  UPDATE public.shipments
  SET status = 'received',
      updated_at = NOW()
  WHERE id = p_shipment_id;
  
  -- 5. Update purchase order status
  IF v_all_received THEN
    UPDATE public.purchase_orders
    SET status = 'received',
        updated_at = NOW()
    WHERE id = v_po.id;
  ELSE
    UPDATE public.purchase_orders
    SET status = 'partial',
        updated_at = NOW()
    WHERE id = v_po.id;
  END IF;
  
  -- 6. Insert worker records for this shipment receipt
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
  
  -- 7. FIXED: Check and update customer_order_items status to 'arrived' when stock becomes available
  -- Now accounts for reservations when checking available stock (reservations are already in current_stock view)
  FOR v_product_in_shipment IN
    SELECT DISTINCT
      poi.product_type,
      poi.accessory_id,
      poi.material_id,
      poi.linear_material_id
    FROM public.purchase_order_items poi
    INNER JOIN public.shipment_items si ON si.purchase_order_item_id = poi.id
    WHERE si.shipment_id = p_shipment_id
      AND si.deleted_at IS NULL
      AND poi.deleted_at IS NULL
      AND si.quantity_received > 0
  LOOP
    -- For each distinct product, find all relevant customer_order_items
    FOR v_customer_item IN
      SELECT
        coi.id as customer_order_item_id,
        coi.quantity as required_qty,
        coi.status as current_status
      FROM public.customer_order_items coi
      WHERE coi.deleted_at IS NULL
        AND coi.item_type = 'product'
        AND coi.status IN ('open', 'in_po', 'ordered')
        AND coi.product_type = v_product_in_shipment.product_type
        AND (
          (v_product_in_shipment.product_type = 'accessory' AND coi.accessory_id = v_product_in_shipment.accessory_id)
          OR (v_product_in_shipment.product_type = 'material' AND coi.material_id = v_product_in_shipment.material_id)
          OR (v_product_in_shipment.product_type = 'linear_material' AND coi.linear_material_id = v_product_in_shipment.linear_material_id)
        )
    LOOP
      -- Check current stock (including reservations) for this specific product in the shipment warehouse
      -- Reservations are already accounted for in current_stock view (they're OUT movements)
      SELECT COALESCE(SUM(quantity_on_hand), 0) INTO v_available_stock
      FROM public.current_stock
      WHERE product_type = v_product_in_shipment.product_type
        AND warehouse_id = v_shipment_warehouse_id
        AND (
          (v_product_in_shipment.product_type = 'accessory' AND accessory_id = v_product_in_shipment.accessory_id)
          OR (v_product_in_shipment.product_type = 'material' AND material_id = v_product_in_shipment.material_id)
          OR (v_product_in_shipment.product_type = 'linear_material' AND linear_material_id = v_product_in_shipment.linear_material_id)
        );
      
      -- If sufficient stock available (after accounting for reservations), update status to 'arrived'
      IF v_available_stock >= v_customer_item.required_qty THEN
        UPDATE public.customer_order_items
        SET status = 'arrived',
            reservation_warehouse_id = v_shipment_warehouse_id,
            updated_at = NOW()
        WHERE id = v_customer_item.customer_order_item_id
          AND status != 'arrived';
        
        -- Trigger will automatically create reservation stock movement
      END IF;
    END LOOP;
  END LOOP;
  
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
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- ============================================
-- 5. Update hand_over_customer_order to use reservation warehouse
-- ============================================
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
  FOR v_item IN
    SELECT 
      coi.id,
      coi.quantity,
      coi.accessory_id,
      coi.material_id,
      coi.linear_material_id,
      coi.product_type,
      COALESCE(coi.reservation_warehouse_id, v_warehouse_id) as item_warehouse_id
    FROM public.customer_order_items coi
    WHERE coi.order_id = p_customer_order_id
      AND coi.deleted_at IS NULL
      AND coi.item_type = 'product'
      AND (coi.accessory_id IS NOT NULL 
        OR coi.material_id IS NOT NULL 
        OR coi.linear_material_id IS NOT NULL)
  LOOP
    -- Create stock movement (OUT) - negative quantity
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
      -1 * v_item.quantity,  -- Negative for OUT
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

COMMENT ON FUNCTION manage_customer_order_item_reservation() IS 
  'Manages stock reservations for customer_order_items. Creates reservation (OUT movement) when status changes to "arrived", and deletes reservation when status changes away from "arrived".';

COMMENT ON FUNCTION receive_shipment(uuid, uuid[]) IS 
  'Receives a shipment and updates stock. Now sets reservation_warehouse_id on customer_order_items and accounts for reservations when checking available stock.';

COMMENT ON FUNCTION hand_over_customer_order(uuid, uuid) IS 
  'Hands over a customer order. Now uses reservation_warehouse_id for stock movements and reservations are automatically deleted by trigger when status changes to "handed_over".';

