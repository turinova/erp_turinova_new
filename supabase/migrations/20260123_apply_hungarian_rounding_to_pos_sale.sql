-- Update create_pos_sale function to save exact values (no Hungarian rounding)
-- Hungarian rounding is only applied for display purposes, not when saving
-- Date: 2026-01-23

CREATE OR REPLACE FUNCTION create_pos_sale(
  p_worker_id uuid,
  p_payment_type text,
  p_customer jsonb DEFAULT '{}'::jsonb,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_fees jsonb DEFAULT '[]'::jsonb,
  p_discount jsonb DEFAULT '{"percentage": 0, "amount": 0}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_warehouse_id uuid;
  v_pos_order_id uuid;
  v_pos_order_number varchar(50);
  v_item jsonb;
  v_fee jsonb;
  v_subtotal_net numeric(12,2) := 0;
  v_total_vat numeric(12,2) := 0;
  v_total_gross numeric(12,2) := 0;
  v_discount_percentage numeric(5,2);
  v_discount_amount numeric(12,2);
  v_item_total_net numeric(12,2);
  v_item_total_vat numeric(12,2);
  v_item_total_gross numeric(12,2);
  v_item_discount_percentage numeric(5,2);
  v_item_discount_amount numeric(12,2);
  v_item_gross_before_discount numeric(12,2);
  v_result jsonb;
  v_product_type varchar(30);
  v_vat_rate numeric(5,2);
  -- Variables for recalculating unit prices from database
  v_base_price numeric(10,2);
  v_multiplier numeric(5,2);
  v_unit_price_net numeric(12,2);
  v_unit_price_gross numeric(12,2);
  -- Variable to determine payment type (for future use if needed)
  v_is_cash_payment boolean;
BEGIN
  -- Determine payment type (currently not used for rounding - exact values saved)
  v_is_cash_payment := (LOWER(p_payment_type) = 'cash');
  
  -- Step 1: Get default warehouse (is_active = true, LIMIT 1)
  SELECT id INTO v_warehouse_id
  FROM public.warehouses
  WHERE is_active = true
  LIMIT 1;

  IF v_warehouse_id IS NULL THEN
    RAISE EXCEPTION 'Nincs aktív raktár. Kérjük, állítson be legalább egy aktív raktárt.';
  END IF;

  -- Step 2: Calculate totals from items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_type := COALESCE(v_item->>'product_type', 'accessory');
    
    -- Get VAT rate for this item
    SELECT kulcs INTO v_vat_rate
    FROM public.vat
    WHERE id = (v_item->>'vat_id')::uuid;
    
    v_vat_rate := COALESCE(v_vat_rate, 0);
    
    -- Recalculate unit prices from database for materials and linear_materials
    IF v_product_type = 'material' AND v_item->>'material_id' IS NOT NULL AND v_item->>'material_id' != '' THEN
      -- Fetch base_price and multiplier from materials table
      SELECT base_price, multiplier INTO v_base_price, v_multiplier
      FROM public.materials
      WHERE id = (v_item->>'material_id')::uuid;
      
      IF v_base_price IS NOT NULL AND v_multiplier IS NOT NULL THEN
        -- Calculate unit price per m²: base_price * multiplier
        v_unit_price_net := v_base_price * v_multiplier;
        v_unit_price_gross := v_unit_price_net * (1 + v_vat_rate / 100);
      ELSE
        -- Fallback to values from frontend if not found in database
        v_unit_price_net := (v_item->>'unit_price_net')::numeric;
        v_unit_price_gross := (v_item->>'unit_price_gross')::numeric;
      END IF;
    ELSIF v_product_type = 'linear_material' AND v_item->>'linear_material_id' IS NOT NULL AND v_item->>'linear_material_id' != '' THEN
      -- Fetch base_price and multiplier from linear_materials table
      SELECT base_price, multiplier INTO v_base_price, v_multiplier
      FROM public.linear_materials
      WHERE id = (v_item->>'linear_material_id')::uuid;
      
      IF v_base_price IS NOT NULL AND v_multiplier IS NOT NULL THEN
        -- Calculate unit price per m: base_price * multiplier
        v_unit_price_net := v_base_price * v_multiplier;
        v_unit_price_gross := v_unit_price_net * (1 + v_vat_rate / 100);
      ELSE
        -- Fallback to values from frontend if not found in database
        v_unit_price_net := (v_item->>'unit_price_net')::numeric;
        v_unit_price_gross := (v_item->>'unit_price_gross')::numeric;
      END IF;
    ELSE
      -- For accessories, use prices from frontend (includes stored gross_price)
      v_unit_price_net := (v_item->>'unit_price_net')::numeric;
      v_unit_price_gross := (v_item->>'unit_price_gross')::numeric;
    END IF;
    
    -- Calculate item totals BEFORE per-item discount
    -- For accessories: use stored gross_price directly (preserves exact stored value)
    -- For materials/linear_materials: calculate from net_price + VAT
    IF v_product_type = 'accessory' THEN
      -- For accessories: use stored gross_price directly (preserves exact stored value)
      v_item_total_gross := ROUND((v_item->>'quantity')::numeric * v_unit_price_gross);
      -- Calculate net and VAT from gross (reverse calculation)
      v_item_total_net := ROUND(v_item_total_gross / (1 + v_vat_rate / 100));
      v_item_total_vat := v_item_total_gross - v_item_total_net;
    ELSE
      -- For materials/linear_materials: calculate from net_price + VAT
      v_item_total_net := ROUND((v_item->>'quantity')::numeric * v_unit_price_net);
      v_item_total_vat := ROUND(v_item_total_net * v_vat_rate / 100);
      v_item_total_gross := v_item_total_net + v_item_total_vat;
    END IF;
    
    -- Store gross before discount for per-item discount calculation
    v_item_gross_before_discount := v_item_total_gross;
    
    -- Get per-item discount (percentage or amount)
    v_item_discount_percentage := COALESCE((v_item->>'discount_percentage')::numeric, 0);
    v_item_discount_amount := COALESCE((v_item->>'discount_amount')::numeric, 0);
    
    -- If discount_amount is provided, use it; otherwise calculate from percentage
    IF v_item_discount_amount = 0 AND v_item_discount_percentage > 0 THEN
      v_item_discount_amount := ROUND((v_item_gross_before_discount * v_item_discount_percentage) / 100);
    ELSE
      v_item_discount_amount := ROUND(v_item_discount_amount);
    END IF;
    
    -- Apply per-item discount to gross total
    v_item_total_gross := ROUND(v_item_gross_before_discount - v_item_discount_amount);
    
    -- Recalculate VAT and net proportionally after per-item discount
    IF v_item_total_gross > 0 AND v_item_gross_before_discount > 0 THEN
      -- Proportional reduction: maintain VAT ratio
      v_item_total_vat := ROUND(v_item_total_vat * (v_item_total_gross / v_item_gross_before_discount));
      v_item_total_net := v_item_total_gross - v_item_total_vat;
    ELSE
      v_item_total_vat := 0;
      v_item_total_net := 0;
    END IF;
    
    -- Add to order totals (after per-item discount)
    v_subtotal_net := v_subtotal_net + v_item_total_net;
    v_total_vat := v_total_vat + v_item_total_vat;
    v_total_gross := v_total_gross + v_item_total_gross;
  END LOOP;

  -- Step 3: Calculate totals from fees
  FOR v_fee IN SELECT * FROM jsonb_array_elements(p_fees)
  LOOP
    -- Get VAT rate for this fee
    SELECT kulcs INTO v_vat_rate
    FROM public.vat
    WHERE id = (v_fee->>'vat_id')::uuid;
    
    v_vat_rate := COALESCE(v_vat_rate, 0);
    
    -- For fees, use prices from frontend
    v_unit_price_net := (v_fee->>'unit_price_net')::numeric;
    v_unit_price_gross := (v_fee->>'unit_price_gross')::numeric;
    
    -- Calculate totals: net, then VAT from net, then gross
    -- Save exact values (no Hungarian rounding - rounding only for display)
    v_item_total_net := ROUND((v_fee->>'quantity')::numeric * v_unit_price_net);
    v_item_total_vat := ROUND(v_item_total_net * v_vat_rate / 100);
    v_item_total_gross := v_item_total_net + v_item_total_vat;
    
    v_subtotal_net := v_subtotal_net + v_item_total_net;
    v_total_vat := v_total_vat + v_item_total_vat;
    v_total_gross := v_total_gross + v_item_total_gross;
  END LOOP;

  -- Step 4: Apply global discount (on top of per-item discounted totals)
  -- Use discount_amount from frontend if provided, otherwise calculate from percentage
  -- Save exact values (no Hungarian rounding - rounding only for display)
  v_discount_percentage := COALESCE((p_discount->>'percentage')::numeric, 0);
  v_discount_amount := COALESCE((p_discount->>'amount')::numeric, 0);

  -- IMPORTANT: Use the discount_amount sent from frontend (it's already calculated correctly)
  -- Only recalculate if amount is truly 0 or NULL and percentage is provided
  -- The frontend calculates discount from its own subtotal, which may differ slightly
  -- from database-calculated total due to rounding, so we trust the frontend value
  IF (v_discount_amount IS NULL OR v_discount_amount <= 0) AND v_discount_percentage > 0 THEN
    -- Recalculate from database total (fallback only - should rarely happen)
    v_discount_amount := ROUND((v_total_gross * v_discount_percentage) / 100);
  ELSE
    -- Use the discount_amount sent from frontend (round to integer for storage)
    v_discount_amount := ROUND(v_discount_amount);
  END IF;
  
  -- Apply discount and round final total (exact values, no Hungarian rounding)
  v_total_gross := ROUND(v_total_gross - v_discount_amount);
  
  -- Recalculate VAT proportionally (simplified: reduce VAT by discount percentage)
  IF v_total_gross > 0 THEN
    v_total_vat := ROUND(v_total_vat * (v_total_gross / (v_total_gross + v_discount_amount)));
    v_subtotal_net := ROUND(v_total_gross - v_total_vat);
  ELSE
    v_total_vat := 0;
    v_subtotal_net := 0;
  END IF;

  -- Step 5: Insert pos_order
  INSERT INTO public.pos_orders (
    worker_id,
    customer_name,
    customer_email,
    customer_mobile,
    billing_name,
    billing_country,
    billing_city,
    billing_postal_code,
    billing_street,
    billing_house_number,
    billing_tax_number,
    billing_company_reg_number,
    discount_percentage,
    discount_amount,
    subtotal_net,
    total_vat,
    total_gross,
    status
  ) VALUES (
    p_worker_id,
    NULLIF(p_customer->>'name', ''),
    NULLIF(p_customer->>'email', ''),
    NULLIF(p_customer->>'mobile', ''),
    NULLIF(p_customer->>'billing_name', ''),
    COALESCE(NULLIF(p_customer->>'billing_country', ''), 'Magyarország'),
    NULLIF(p_customer->>'billing_city', ''),
    NULLIF(p_customer->>'billing_postal_code', ''),
    NULLIF(p_customer->>'billing_street', ''),
    NULLIF(p_customer->>'billing_house_number', ''),
    NULLIF(p_customer->>'billing_tax_number', ''),
    NULLIF(p_customer->>'billing_company_reg_number', ''),
    v_discount_percentage,
    v_discount_amount,
    v_subtotal_net,
    v_total_vat,
    v_total_gross,
    'completed'
  )
  RETURNING id, pos_order_number INTO v_pos_order_id, v_pos_order_number;

  -- Step 6: Insert pos_order_items (products)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_type := COALESCE(v_item->>'product_type', 'accessory');
    
    -- Get VAT rate for this item
    SELECT kulcs INTO v_vat_rate
    FROM public.vat
    WHERE id = (v_item->>'vat_id')::uuid;
    
    v_vat_rate := COALESCE(v_vat_rate, 0);
    
    -- Recalculate unit prices from database for materials and linear_materials
    IF v_product_type = 'material' AND v_item->>'material_id' IS NOT NULL AND v_item->>'material_id' != '' THEN
      -- Fetch base_price and multiplier from materials table
      SELECT base_price, multiplier INTO v_base_price, v_multiplier
      FROM public.materials
      WHERE id = (v_item->>'material_id')::uuid;
      
      IF v_base_price IS NOT NULL AND v_multiplier IS NOT NULL THEN
        -- Calculate unit price per m²: base_price * multiplier
        v_unit_price_net := v_base_price * v_multiplier;
        v_unit_price_gross := v_unit_price_net * (1 + v_vat_rate / 100);
      ELSE
        -- Fallback to values from frontend if not found in database
        v_unit_price_net := (v_item->>'unit_price_net')::numeric;
        v_unit_price_gross := (v_item->>'unit_price_gross')::numeric;
      END IF;
    ELSIF v_product_type = 'linear_material' AND v_item->>'linear_material_id' IS NOT NULL AND v_item->>'linear_material_id' != '' THEN
      -- Fetch base_price and multiplier from linear_materials table
      SELECT base_price, multiplier INTO v_base_price, v_multiplier
      FROM public.linear_materials
      WHERE id = (v_item->>'linear_material_id')::uuid;
      
      IF v_base_price IS NOT NULL AND v_multiplier IS NOT NULL THEN
        -- Calculate unit price per m: base_price * multiplier
        v_unit_price_net := v_base_price * v_multiplier;
        v_unit_price_gross := v_unit_price_net * (1 + v_vat_rate / 100);
      ELSE
        -- Fallback to values from frontend if not found in database
        v_unit_price_net := (v_item->>'unit_price_net')::numeric;
        v_unit_price_gross := (v_item->>'unit_price_gross')::numeric;
      END IF;
    ELSE
      -- For accessories, use prices from frontend (includes stored gross_price)
      v_unit_price_net := (v_item->>'unit_price_net')::numeric;
      v_unit_price_gross := (v_item->>'unit_price_gross')::numeric;
    END IF;
    
    -- Calculate item totals BEFORE per-item discount
    -- For accessories: use stored gross_price directly (preserves exact stored value)
    -- For materials/linear_materials: calculate from net_price + VAT
    IF v_product_type = 'accessory' THEN
      -- For accessories: use stored gross_price directly (preserves exact stored value)
      v_item_total_gross := ROUND((v_item->>'quantity')::numeric * v_unit_price_gross);
      -- Calculate net and VAT from gross (reverse calculation)
      v_item_total_net := ROUND(v_item_total_gross / (1 + v_vat_rate / 100));
      v_item_total_vat := v_item_total_gross - v_item_total_net;
    ELSE
      -- For materials/linear_materials: calculate from net_price + VAT
      v_item_total_net := ROUND((v_item->>'quantity')::numeric * v_unit_price_net);
      v_item_total_vat := ROUND(v_item_total_net * v_vat_rate / 100);
      v_item_total_gross := v_item_total_net + v_item_total_vat;
    END IF;
    
    -- Store gross before discount for per-item discount calculation
    v_item_gross_before_discount := v_item_total_gross;
    
    -- Get per-item discount (percentage or amount)
    v_item_discount_percentage := COALESCE((v_item->>'discount_percentage')::numeric, 0);
    v_item_discount_amount := COALESCE((v_item->>'discount_amount')::numeric, 0);
    
    -- If discount_amount is provided, use it; otherwise calculate from percentage
    IF v_item_discount_amount = 0 AND v_item_discount_percentage > 0 THEN
      v_item_discount_amount := ROUND((v_item_gross_before_discount * v_item_discount_percentage) / 100);
    ELSE
      v_item_discount_amount := ROUND(v_item_discount_amount);
    END IF;
    
    -- Apply per-item discount to gross total
    v_item_total_gross := ROUND(v_item_gross_before_discount - v_item_discount_amount);
    
    -- Recalculate VAT and net proportionally after per-item discount
    IF v_item_total_gross > 0 AND v_item_gross_before_discount > 0 THEN
      -- Proportional reduction: maintain VAT ratio
      v_item_total_vat := ROUND(v_item_total_vat * (v_item_total_gross / v_item_gross_before_discount));
      v_item_total_net := v_item_total_gross - v_item_total_vat;
    ELSE
      v_item_total_vat := 0;
      v_item_total_net := 0;
    END IF;
    
    INSERT INTO public.pos_order_items (
      pos_order_id,
      item_type,
      product_type,
      accessory_id,
      material_id,
      linear_material_id,
      product_name,
      sku,
      quantity,
      unit_price_net,
      unit_price_gross,
      vat_id,
      currency_id,
      total_net,
      total_vat,
      total_gross,
      discount_percentage,
      discount_amount
    ) VALUES (
      v_pos_order_id,
      'product',
      v_product_type,
      CASE WHEN v_item->>'accessory_id' IS NOT NULL AND v_item->>'accessory_id' != '' THEN (v_item->>'accessory_id')::uuid ELSE NULL END,
      CASE WHEN v_item->>'material_id' IS NOT NULL AND v_item->>'material_id' != '' THEN (v_item->>'material_id')::uuid ELSE NULL END,
      CASE WHEN v_item->>'linear_material_id' IS NOT NULL AND v_item->>'linear_material_id' != '' THEN (v_item->>'linear_material_id')::uuid ELSE NULL END,
      v_item->>'name',
      NULLIF(v_item->>'sku', ''),
      (v_item->>'quantity')::numeric,
      v_unit_price_net,  -- Use recalculated unit price
      v_unit_price_gross,  -- Use recalculated unit price
      (v_item->>'vat_id')::uuid,
      (v_item->>'currency_id')::uuid,
      v_item_total_net,
      v_item_total_vat,
      v_item_total_gross,
      v_item_discount_percentage,
      v_item_discount_amount
    );
  END LOOP;

  -- Step 7: Insert pos_order_items (fees)
  FOR v_fee IN SELECT * FROM jsonb_array_elements(p_fees)
  LOOP
    -- Get VAT rate for this fee
    SELECT kulcs INTO v_vat_rate
    FROM public.vat
    WHERE id = (v_fee->>'vat_id')::uuid;
    
    v_vat_rate := COALESCE(v_vat_rate, 0);
    
    -- For fees, use prices from frontend
    v_unit_price_net := (v_fee->>'unit_price_net')::numeric;
    v_unit_price_gross := (v_fee->>'unit_price_gross')::numeric;
    
    -- Calculate totals: net, then VAT from net, then gross
    -- Save exact values (no Hungarian rounding - rounding only for display)
    v_item_total_net := ROUND((v_fee->>'quantity')::numeric * v_unit_price_net);
    v_item_total_vat := ROUND(v_item_total_net * v_vat_rate / 100);
    v_item_total_gross := v_item_total_net + v_item_total_vat;
    
    INSERT INTO public.pos_order_items (
      pos_order_id,
      item_type,
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
      total_gross,
      discount_percentage,
      discount_amount
    ) VALUES (
      v_pos_order_id,
      'fee',
      CASE WHEN v_fee->>'feetype_id' IS NOT NULL AND v_fee->>'feetype_id' != '' THEN (v_fee->>'feetype_id')::uuid ELSE NULL END,
      v_fee->>'name',
      NULL,
      (v_fee->>'quantity')::numeric,
      v_unit_price_net,
      v_unit_price_gross,
      (v_fee->>'vat_id')::uuid,
      (v_fee->>'currency_id')::uuid,
      v_item_total_net,
      v_item_total_vat,
      v_item_total_gross,
      0,  -- Fees don't have per-item discounts
      0   -- Fees don't have per-item discounts
    );
  END LOOP;

  -- Step 8: Insert pos_payment
  INSERT INTO public.pos_payments (
    pos_order_id,
    payment_type,
    amount,
    status
  ) VALUES (
    v_pos_order_id,
    p_payment_type,
    v_total_gross,
    'completed'
  );

  -- Step 9: Create stock movements for each product item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_type := COALESCE(v_item->>'product_type', 'accessory');
    
    IF v_product_type = 'accessory' AND v_item->>'accessory_id' IS NOT NULL AND v_item->>'accessory_id' != '' THEN
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
        v_pos_order_id,
        'POS order: ' || v_pos_order_number
      );
    ELSIF v_product_type = 'material' AND v_item->>'material_id' IS NOT NULL AND v_item->>'material_id' != '' THEN
      INSERT INTO public.stock_movements (
        warehouse_id,
        product_type,
        material_id,
        quantity,
        movement_type,
        source_type,
        source_id,
        note
      ) VALUES (
        v_warehouse_id,
        'material',
        (v_item->>'material_id')::uuid,
        -1 * (v_item->>'quantity')::numeric, -- negative for outgoing
        'out',
        'pos_sale',
        v_pos_order_id,
        'POS order: ' || v_pos_order_number
      );
    ELSIF v_product_type = 'linear_material' AND v_item->>'linear_material_id' IS NOT NULL AND v_item->>'linear_material_id' != '' THEN
      INSERT INTO public.stock_movements (
        warehouse_id,
        product_type,
        linear_material_id,
        quantity,
        movement_type,
        source_type,
        source_id,
        note
      ) VALUES (
        v_warehouse_id,
        'linear_material',
        (v_item->>'linear_material_id')::uuid,
        -1 * (v_item->>'quantity')::numeric, -- negative for outgoing
        'out',
        'pos_sale',
        v_pos_order_id,
        'POS order: ' || v_pos_order_number
      );
    END IF;
  END LOOP;

  -- Step 10: Return result
  SELECT jsonb_build_object(
    'pos_order', (
      SELECT jsonb_build_object(
        'id', id,
        'pos_order_number', pos_order_number,
        'worker_id', worker_id,
        'total_gross', total_gross,
        'status', status,
        'created_at', created_at
      )
      FROM public.pos_orders
      WHERE id = v_pos_order_id
    ),
    'items', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', id,
          'item_type', item_type,
          'product_name', product_name,
          'quantity', quantity,
          'total_gross', total_gross
        )
      )
      FROM public.pos_order_items
      WHERE pos_order_id = v_pos_order_id
    ),
    'payment', (
      SELECT jsonb_build_object(
        'id', id,
        'payment_type', payment_type,
        'amount', amount,
        'status', status
      )
      FROM public.pos_payments
      WHERE pos_order_id = v_pos_order_id
    )
  ) INTO v_result;

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Hiba a POS rendelés létrehozásakor: %', SQLERRM;
END;
$$;
