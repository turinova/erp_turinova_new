-- ============================================
-- PostgreSQL Function: update_pos_order()
-- ============================================
-- Purpose: Atomically update POS order with all changes including stock movement reversals
-- Parameters:
--   p_pos_order_id: uuid - The POS order ID to update
--   p_customer_data: jsonb - Customer and billing fields
--   p_discount: jsonb - discount_percentage and discount_amount
--   p_items: jsonb - Array of pos_order_items (products and fees) with all fields
-- ============================================

CREATE OR REPLACE FUNCTION public.update_pos_order(
  p_pos_order_id uuid,
  p_customer_data jsonb,
  p_discount jsonb,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_warehouse_id uuid;
  v_pos_order_number varchar(50);
  v_subtotal_net numeric(12,2) := 0;
  v_total_vat numeric(12,2) := 0;
  v_total_gross numeric(12,2) := 0;
  v_discount_percentage numeric(5,2) := 0;
  v_discount_amount numeric(12,2) := 0;
  v_item_total_net numeric(12,2);
  v_item_total_vat numeric(12,2);
  v_item_total_gross numeric(12,2);
  v_item jsonb;
  v_existing_item record;
  v_existing_movement record;
  v_old_quantity numeric(10,2);
  v_new_quantity numeric(10,2);
  v_quantity_diff numeric(10,2);
  v_result jsonb;
BEGIN
  -- Step 1: Verify order exists
  SELECT pos_order_number INTO v_pos_order_number
  FROM public.pos_orders
  WHERE id = p_pos_order_id AND deleted_at IS NULL;
  
  IF v_pos_order_number IS NULL THEN
    RAISE EXCEPTION 'POS rendelés nem található vagy törölve';
  END IF;

  -- Step 2: Get warehouse_id from existing stock movements (or query active warehouse)
  SELECT warehouse_id INTO v_warehouse_id
  FROM public.stock_movements
  WHERE source_type = 'pos_sale' AND source_id = p_pos_order_id
  LIMIT 1;
  
  -- If no existing movements, get active warehouse
  IF v_warehouse_id IS NULL THEN
    SELECT id INTO v_warehouse_id
    FROM public.warehouses
    WHERE is_active = true
    LIMIT 1;
    
    IF v_warehouse_id IS NULL THEN
      RAISE EXCEPTION 'Nincs aktív raktár. Kérjük, állítson be legalább egy aktív raktárt.';
    END IF;
  END IF;

  -- Step 3: Calculate totals from items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Skip soft-deleted items (they will be handled separately)
    IF v_item->>'deleted' = 'true' THEN
      CONTINUE;
    END IF;
    
    v_item_total_net := (v_item->>'quantity')::numeric * (v_item->>'unit_price_net')::numeric;
    v_item_total_vat := (v_item->>'quantity')::numeric * ((v_item->>'unit_price_gross')::numeric - (v_item->>'unit_price_net')::numeric);
    v_item_total_gross := (v_item->>'quantity')::numeric * (v_item->>'unit_price_gross')::numeric;
    
    v_subtotal_net := v_subtotal_net + v_item_total_net;
    v_total_vat := v_total_vat + v_item_total_vat;
    v_total_gross := v_total_gross + v_item_total_gross;
  END LOOP;

  -- Step 4: Apply discount
  v_discount_percentage := COALESCE((p_discount->>'percentage')::numeric, 0);
  v_discount_amount := COALESCE((p_discount->>'amount')::numeric, 0);
  
  -- If discount_amount is provided, use it; otherwise calculate from percentage
  IF v_discount_amount = 0 AND v_discount_percentage > 0 THEN
    v_discount_amount := (v_total_gross * v_discount_percentage) / 100;
  END IF;
  
  v_total_gross := v_total_gross - v_discount_amount;

  -- Step 5: Update pos_orders
  UPDATE public.pos_orders
  SET
    customer_name = NULLIF(p_customer_data->>'customer_name', ''),
    customer_email = NULLIF(p_customer_data->>'customer_email', ''),
    customer_mobile = NULLIF(p_customer_data->>'customer_mobile', ''),
    billing_name = NULLIF(p_customer_data->>'billing_name', ''),
    billing_country = COALESCE(NULLIF(p_customer_data->>'billing_country', ''), 'Magyarország'),
    billing_city = NULLIF(p_customer_data->>'billing_city', ''),
    billing_postal_code = NULLIF(p_customer_data->>'billing_postal_code', ''),
    billing_street = NULLIF(p_customer_data->>'billing_street', ''),
    billing_house_number = NULLIF(p_customer_data->>'billing_house_number', ''),
    billing_tax_number = NULLIF(p_customer_data->>'billing_tax_number', ''),
    billing_company_reg_number = NULLIF(p_customer_data->>'billing_company_reg_number', ''),
    discount_percentage = v_discount_percentage,
    discount_amount = v_discount_amount,
    subtotal_net = v_subtotal_net,
    total_vat = v_total_vat,
    total_gross = v_total_gross,
    updated_at = now()
  WHERE id = p_pos_order_id;

  -- Step 6: Handle pos_order_items (update, insert, soft-delete)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- If item has an ID, it's an existing item
    IF v_item->>'id' IS NOT NULL AND v_item->>'id' != '' THEN
      -- Check if item should be soft-deleted
      IF v_item->>'deleted' = 'true' THEN
        -- Soft delete the item
        UPDATE public.pos_order_items
        SET deleted_at = now(), updated_at = now()
        WHERE id = (v_item->>'id')::uuid;
        
        -- If it's a product (not a fee), create reverse stock movement
        IF (v_item->>'item_type')::text = 'product' AND (v_item->>'accessory_id') IS NOT NULL THEN
          -- Get the old quantity from the item before deletion
          SELECT quantity INTO v_old_quantity
          FROM public.pos_order_items
          WHERE id = (v_item->>'id')::uuid;
          
          -- Create IN movement to reverse the original OUT movement
          IF v_old_quantity IS NOT NULL AND v_old_quantity > 0 THEN
            INSERT INTO public.stock_movements (
              warehouse_id,
              product_type,
              accessory_id,
              quantity,
              movement_type,
              source_type,
              source_id,
              note
            ) VALUES (
              v_warehouse_id,
              'accessory',
              (v_item->>'accessory_id')::uuid,
              v_old_quantity, -- positive for IN movement
              'in',
              'pos_sale',
              p_pos_order_id,
              'POS rendelés módosítás: tétel törölve - ' || v_pos_order_number
            );
          END IF;
        END IF;
      ELSE
        -- Update existing item
        SELECT quantity INTO v_old_quantity
        FROM public.pos_order_items
        WHERE id = (v_item->>'id')::uuid;
        
        v_new_quantity := (v_item->>'quantity')::numeric;
        v_item_total_net := v_new_quantity * (v_item->>'unit_price_net')::numeric;
        v_item_total_vat := v_new_quantity * ((v_item->>'unit_price_gross')::numeric - (v_item->>'unit_price_net')::numeric);
        v_item_total_gross := v_new_quantity * (v_item->>'unit_price_gross')::numeric;
        
        UPDATE public.pos_order_items
        SET
          product_name = v_item->>'product_name',
          sku = NULLIF(v_item->>'sku', ''),
          quantity = v_new_quantity,
          unit_price_net = (v_item->>'unit_price_net')::numeric,
          unit_price_gross = (v_item->>'unit_price_gross')::numeric,
          vat_id = (v_item->>'vat_id')::uuid,
          currency_id = (v_item->>'currency_id')::uuid,
          total_net = v_item_total_net,
          total_vat = v_item_total_vat,
          total_gross = v_item_total_gross,
          updated_at = now()
        WHERE id = (v_item->>'id')::uuid;
        
        -- If it's a product (not a fee), handle stock movements
        IF (v_item->>'item_type')::text = 'product' AND (v_item->>'accessory_id') IS NOT NULL THEN
          -- Calculate quantity difference
          v_quantity_diff := v_new_quantity - COALESCE(v_old_quantity, 0);
          
          IF v_quantity_diff != 0 THEN
            IF v_quantity_diff < 0 THEN
              -- Quantity decreased: create IN movement (reverse the difference)
              INSERT INTO public.stock_movements (
                warehouse_id,
                product_type,
                accessory_id,
                quantity,
                movement_type,
                source_type,
                source_id,
                note
              ) VALUES (
                v_warehouse_id,
                'accessory',
                (v_item->>'accessory_id')::uuid,
                ABS(v_quantity_diff), -- positive for IN movement
                'in',
                'pos_sale',
                p_pos_order_id,
                'POS rendelés módosítás: mennyiség csökkentve - ' || v_pos_order_number
              );
            ELSE
              -- Quantity increased: create OUT movement (for the additional quantity)
              INSERT INTO public.stock_movements (
                warehouse_id,
                product_type,
                accessory_id,
                quantity,
                movement_type,
                source_type,
                source_id,
                note
              ) VALUES (
                v_warehouse_id,
                'accessory',
                (v_item->>'accessory_id')::uuid,
                -1 * v_quantity_diff, -- negative for OUT movement
                'out',
                'pos_sale',
                p_pos_order_id,
                'POS rendelés módosítás: mennyiség növelve - ' || v_pos_order_number
              );
            END IF;
          END IF;
        END IF;
      END IF;
    ELSE
      -- New item (no ID)
      IF v_item->>'deleted' != 'true' THEN
        v_item_total_net := (v_item->>'quantity')::numeric * (v_item->>'unit_price_net')::numeric;
        v_item_total_vat := (v_item->>'quantity')::numeric * ((v_item->>'unit_price_gross')::numeric - (v_item->>'unit_price_net')::numeric);
        v_item_total_gross := (v_item->>'quantity')::numeric * (v_item->>'unit_price_gross')::numeric;
        
        INSERT INTO public.pos_order_items (
          pos_order_id,
          item_type,
          accessory_id,
          feetype_id,
          product_name,
          sku,
          quantity,
          unit_price_net,
          unit_price_gross,
          vat_id,
          currency_id,
          total_net,
          total_vat,
          total_gross
        ) VALUES (
          p_pos_order_id,
          (v_item->>'item_type')::varchar,
          CASE WHEN (v_item->>'accessory_id') IS NOT NULL AND (v_item->>'accessory_id') != '' THEN (v_item->>'accessory_id')::uuid ELSE NULL END,
          CASE WHEN (v_item->>'feetype_id') IS NOT NULL AND (v_item->>'feetype_id') != '' THEN (v_item->>'feetype_id')::uuid ELSE NULL END,
          v_item->>'product_name',
          NULLIF(v_item->>'sku', ''),
          (v_item->>'quantity')::numeric,
          (v_item->>'unit_price_net')::numeric,
          (v_item->>'unit_price_gross')::numeric,
          (v_item->>'vat_id')::uuid,
          (v_item->>'currency_id')::uuid,
          v_item_total_net,
          v_item_total_vat,
          v_item_total_gross
        );
        
        -- If it's a new product (not a fee), create OUT stock movement
        IF (v_item->>'item_type')::text = 'product' AND (v_item->>'accessory_id') IS NOT NULL THEN
          INSERT INTO public.stock_movements (
            warehouse_id,
            product_type,
            accessory_id,
            quantity,
            movement_type,
            source_type,
            source_id,
            note
          ) VALUES (
            v_warehouse_id,
            'accessory',
            (v_item->>'accessory_id')::uuid,
            -1 * (v_item->>'quantity')::numeric, -- negative for outgoing
            'out',
            'pos_sale',
            p_pos_order_id,
            'POS rendelés módosítás: új tétel hozzáadva - ' || v_pos_order_number
          );
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- Step 7: Return updated order data
  SELECT jsonb_build_object(
    'success', true,
    'pos_order_id', p_pos_order_id,
    'pos_order_number', v_pos_order_number,
    'subtotal_net', v_subtotal_net,
    'total_vat', v_total_vat,
    'total_gross', v_total_gross,
    'discount_percentage', v_discount_percentage,
    'discount_amount', v_discount_amount
  ) INTO v_result;

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Hiba a POS rendelés frissítésekor: %', SQLERRM;
END;
$$;

