-- ============================================
-- Create Stock Movement Reservations for Quotes
-- ============================================
-- This migration creates stock movement reservations when quote status changes to 'in_production'
-- and converts them to actual OUT movements when status changes to 'finished'

-- ============================================
-- 1. Update source_type constraint to include 'quote_reservation'
-- ============================================
DO $$
BEGIN
  -- Drop existing constraint if it exists
  ALTER TABLE public.stock_movements 
    DROP CONSTRAINT IF EXISTS stock_movements_source_type_check;
  
  -- Add new constraint with 'quote_reservation'
  ALTER TABLE public.stock_movements
    ADD CONSTRAINT stock_movements_source_type_check 
    CHECK (source_type IN (
      'purchase_receipt',
      'pos_sale',
      'adjustment',
      'customer_order_handover',
      'customer_order_reservation',
      'quote',
      'quote_reservation'
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
        'customer_order_reservation',
        'quote',
        'quote_reservation'
      ));
END $$;

-- ============================================
-- 2. Replace existing function to handle both reservation and OUT movements
-- ============================================
CREATE OR REPLACE FUNCTION create_quote_stock_movements()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_pricing_record RECORD;
  v_material_record RECORD;
  v_warehouse_id uuid;
  v_calculated_quantity numeric(10, 2);
  v_existing_movement_id uuid;
  v_existing_reservation_id uuid;
  v_quote_number text;
BEGIN
  -- ============================================
  -- PART 1: Handle status change TO 'in_production' - Create reservations
  -- ============================================
  IF NEW.status = 'in_production' AND (OLD.status IS NULL OR OLD.status != 'in_production') THEN
    
    -- Get quote number for note
    v_quote_number := COALESCE(NEW.order_number, NEW.quote_number, NEW.id::text);
    
    -- Loop through all quote_materials_pricing records for this quote
    FOR v_pricing_record IN
      SELECT 
        id,
        material_id,
        material_name,
        boards_used,
        COALESCE(charged_sqm, 0) AS charged_sqm,
        waste_multi
      FROM public.quote_materials_pricing
      WHERE quote_id = NEW.id
    LOOP
      -- Skip if no boards used and no charged sqm
      IF v_pricing_record.boards_used <= 0 AND v_pricing_record.charged_sqm <= 0 THEN
        CONTINUE;
      END IF;
      
      -- Check if reservation already exists for this quote and material (prevent duplicates)
      SELECT id INTO v_existing_reservation_id
      FROM public.stock_movements
      WHERE source_type = 'quote_reservation'
        AND source_id = NEW.id
        AND material_id = v_pricing_record.material_id
        AND movement_type = 'out';
      
      IF v_existing_reservation_id IS NOT NULL THEN
        -- Reservation already exists, skip
        CONTINUE;
      END IF;
      
      -- Fetch material dimensions
      SELECT 
        length_mm,
        width_mm,
        default_warehouse_id
      INTO v_material_record
      FROM public.materials
      WHERE id = v_pricing_record.material_id;
      
      -- Skip if material not found
      IF v_material_record IS NULL THEN
        RAISE WARNING 'Material % not found for quote %', v_pricing_record.material_id, NEW.id;
        CONTINUE;
      END IF;
      
      -- Calculate quantity: boards_used * length_mm * width_mm / 1000000 + charged_sqm / waste_multi
      v_calculated_quantity := (
        v_pricing_record.boards_used::numeric * 
        v_material_record.length_mm::numeric * 
        v_material_record.width_mm::numeric / 
        1000000::numeric
      ) + (
        CASE 
          WHEN v_pricing_record.waste_multi > 0 THEN 
            v_pricing_record.charged_sqm / v_pricing_record.waste_multi
          ELSE 
            v_pricing_record.charged_sqm
        END
      );
      
      -- Skip if calculated quantity is zero or negative
      IF v_calculated_quantity <= 0 THEN
        CONTINUE;
      END IF;
      
      -- Determine warehouse_id:
      -- 1. Use material's default_warehouse_id if available
      -- 2. Otherwise, use first active warehouse
      v_warehouse_id := v_material_record.default_warehouse_id;
      
      IF v_warehouse_id IS NULL THEN
        SELECT id INTO v_warehouse_id
        FROM public.warehouses
        WHERE is_active = true
        ORDER BY created_at
        LIMIT 1;
      END IF;
      
      -- Skip if no warehouse found
      IF v_warehouse_id IS NULL THEN
        RAISE WARNING 'No active warehouse found for quote % material %', NEW.id, v_pricing_record.material_id;
        CONTINUE;
      END IF;
      
      -- Insert reservation stock movement (negative quantity for OUT movement)
      INSERT INTO public.stock_movements (
        warehouse_id,
        product_type,
        material_id,
        quantity,
        movement_type,
        source_type,
        source_id,
        note,
        stock_movement_number
      ) VALUES (
        v_warehouse_id,
        'material',
        v_pricing_record.material_id,
        -1 * v_calculated_quantity,  -- Negative for OUT movement (reservation)
        'out',
        'quote_reservation',
        NEW.id,
        'Foglalás: ' || v_quote_number || ' - ' || v_pricing_record.material_name,
        generate_stock_movement_number()
      );
      
    END LOOP;
    
  END IF;

  -- ============================================
  -- PART 2: Handle status change TO 'ready' - Delete reservations and create OUT movements
  -- ============================================
  IF NEW.status = 'ready' AND (OLD.status IS NULL OR OLD.status != 'ready') THEN
    
    -- Get quote number for note
    v_quote_number := COALESCE(NEW.order_number, NEW.quote_number, NEW.id::text);
    
    -- First, delete all reservation movements for this quote
    DELETE FROM public.stock_movements
    WHERE source_type = 'quote_reservation'
      AND source_id = NEW.id;
    
    -- Loop through all quote_materials_pricing records for this quote
    FOR v_pricing_record IN
      SELECT 
        id,
        material_id,
        material_name,
        boards_used,
        COALESCE(charged_sqm, 0) AS charged_sqm,
        waste_multi
      FROM public.quote_materials_pricing
      WHERE quote_id = NEW.id
    LOOP
      -- Skip if no boards used and no charged sqm
      IF v_pricing_record.boards_used <= 0 AND v_pricing_record.charged_sqm <= 0 THEN
        CONTINUE;
      END IF;
      
      -- Check if stock movement already exists for this quote and material (prevent duplicates)
      SELECT id INTO v_existing_movement_id
      FROM public.stock_movements
      WHERE source_type = 'quote'
        AND source_id = NEW.id
        AND material_id = v_pricing_record.material_id
        AND movement_type = 'out';
      
      IF v_existing_movement_id IS NOT NULL THEN
        -- Stock movement already exists, skip
        CONTINUE;
      END IF;
      
      -- Fetch material dimensions
      SELECT 
        length_mm,
        width_mm,
        default_warehouse_id
      INTO v_material_record
      FROM public.materials
      WHERE id = v_pricing_record.material_id;
      
      -- Skip if material not found
      IF v_material_record IS NULL THEN
        RAISE WARNING 'Material % not found for quote %', v_pricing_record.material_id, NEW.id;
        CONTINUE;
      END IF;
      
      -- Calculate quantity: boards_used * length_mm * width_mm / 1000000 + charged_sqm / waste_multi
      v_calculated_quantity := (
        v_pricing_record.boards_used::numeric * 
        v_material_record.length_mm::numeric * 
        v_material_record.width_mm::numeric / 
        1000000::numeric
      ) + (
        CASE 
          WHEN v_pricing_record.waste_multi > 0 THEN 
            v_pricing_record.charged_sqm / v_pricing_record.waste_multi
          ELSE 
            v_pricing_record.charged_sqm
        END
      );
      
      -- Skip if calculated quantity is zero or negative
      IF v_calculated_quantity <= 0 THEN
        CONTINUE;
      END IF;
      
      -- Determine warehouse_id:
      -- 1. Use material's default_warehouse_id if available
      -- 2. Otherwise, use first active warehouse
      v_warehouse_id := v_material_record.default_warehouse_id;
      
      IF v_warehouse_id IS NULL THEN
        SELECT id INTO v_warehouse_id
        FROM public.warehouses
        WHERE is_active = true
        ORDER BY created_at
        LIMIT 1;
      END IF;
      
      -- Skip if no warehouse found
      IF v_warehouse_id IS NULL THEN
        RAISE WARNING 'No active warehouse found for quote % material %', NEW.id, v_pricing_record.material_id;
        CONTINUE;
      END IF;
      
      -- Insert stock movement (negative quantity for OUT movement)
      INSERT INTO public.stock_movements (
        warehouse_id,
        product_type,
        material_id,
        quantity,
        movement_type,
        source_type,
        source_id,
        note,
        stock_movement_number
      ) VALUES (
        v_warehouse_id,
        'material',
        v_pricing_record.material_id,
        -1 * v_calculated_quantity,  -- Negative for OUT movement
        'out',
        'quote',
        NEW.id,
        'Kivételezés: ' || v_quote_number || ' - ' || v_pricing_record.material_name,
        generate_stock_movement_number()
      );
      
    END LOOP;
    
  END IF;

  -- ============================================
  -- PART 3: Handle status change FROM 'in_production' to something else - Delete reservations
  -- ============================================
  IF OLD.status = 'in_production' AND NEW.status != 'in_production' AND NEW.status != 'ready' THEN
    -- Delete all reservation movements for this quote (status changed away from in_production)
    DELETE FROM public.stock_movements
    WHERE source_type = 'quote_reservation'
      AND source_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================
-- 3. Update trigger (already exists, will be replaced)
-- ============================================
-- Trigger is already created in previous migration, no need to recreate

-- ============================================
-- 4. Update comments
-- ============================================
COMMENT ON FUNCTION create_quote_stock_movements() IS 
  'Creates stock movement reservations when quote status changes to in_production, and converts them to OUT movements when status changes to ready. Deletes reservations if status changes away from in_production.';

COMMENT ON TRIGGER trigger_create_quote_stock_movements ON public.quotes IS 
  'Automatically creates stock movement reservations when quote status changes to in_production, and converts to OUT movements when status changes to ready. Prevents duplicate movements by checking for existing records.';
