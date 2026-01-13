-- =============================================================================
-- FIND OPTIMAL MACHINE THRESHOLD FOR 60-40 CUTTING LENGTH DISTRIBUTION
-- =============================================================================
-- Purpose: Analyze past orders to find the threshold that distributes
--          cutting length as 60% Machine 2 (large panels) and 40% Machine 1 (small panels)
-- =============================================================================
-- HOW TO USE:
-- 1. Run this entire script in your SQL editor
-- 2. The result set shows the best threshold recommendation first (result_type = 'BEST')
-- 3. Followed by the top 20 thresholds closest to 60% Machine 2 (result_type = 'Top 20')
-- 4. Look for the threshold with lowest "Deviation from 60%" value
-- 5. Update the threshold in opti-settings page with the recommended value
-- =============================================================================
-- INTERPRETATION:
-- - Machine 2 %: Percentage of cutting length that goes to Machine 2 (target: 60%)
-- - Machine 1 %: Percentage of cutting length that goes to Machine 1 (target: 40%)
-- - Deviation from 60%: How far from the 60% target (lower is better)
-- - Machine 3 orders are excluded from the 60-40 split (special cases)
-- =============================================================================
-- OPTIONAL: To analyze only recent orders, uncomment the date filter in Step 1
-- =============================================================================

-- Step 1: Count panels per material for each quote
WITH panels_by_material AS (
  SELECT 
    qp.quote_id,
    qp.material_id,
    SUM(qp.quantity) as panel_count
  FROM quote_panels qp
  INNER JOIN quotes q ON q.id = qp.quote_id
  WHERE 
    q.status IN ('ordered', 'in_production', 'ready', 'finished')
    AND q.deleted_at IS NULL
    -- Optional: Filter by date (uncomment to use only recent orders)
    -- AND q.created_at >= NOW() - INTERVAL '12 months'
  GROUP BY qp.quote_id, qp.material_id
),
-- Step 2: Calculate material metrics (same as AssignProductionModal)
material_metrics AS (
  SELECT 
    qmp.quote_id,
    qmp.material_id,
    COALESCE(pbm.panel_count, 0) as panel_count,
    qmp.boards_used,
    qmp.charged_sqm,
    qmp.usage_percentage,
    qmp.waste_multi,
    qmp.cutting_length_m,
    -- actualMaterialUsed = (boardAreaM2 * boards_used + charged_sqm) / waste_multi
    ((qmp.board_width_mm * qmp.board_length_mm / 1000000.0) * qmp.boards_used + COALESCE(qmp.charged_sqm, 0)) 
    / NULLIF(qmp.waste_multi, 1) as actual_material_used
  FROM quote_materials_pricing qmp
  LEFT JOIN panels_by_material pbm ON pbm.quote_id = qmp.quote_id AND pbm.material_id = qmp.material_id
  INNER JOIN quotes q ON q.id = qmp.quote_id
  WHERE 
    q.status IN ('ordered', 'in_production', 'ready', 'finished')
    AND q.deleted_at IS NULL
    -- Optional: Filter by date (uncomment to use only recent orders)
    -- AND q.created_at >= NOW() - INTERVAL '12 months'
),
-- Step 3: Calculate m²/panel for each quote (matching AssignProductionModal logic exactly)
quote_m2_per_panel AS (
  SELECT 
    q.id as quote_id,
    q.quote_number,
    q.order_number,
    q.status,
    q.created_at,
    COUNT(DISTINCT mm.material_id) as material_count,
    -- Total panels across all materials
    SUM(mm.panel_count) as total_panels,
    -- Total actual material used
    SUM(mm.actual_material_used) as total_actual_material_used,
    -- Total cutting length for this quote
    SUM(mm.cutting_length_m) as total_cutting_length,
    -- Check if Machine 3 case (single material, no boards, usage < 65%)
    CASE 
      WHEN COUNT(DISTINCT mm.material_id) = 1 
        AND SUM(mm.boards_used) = 0 
        AND MAX(mm.usage_percentage) < 65 
      THEN true
      ELSE false
    END as is_machine_3,
    -- Calculate m² per panel (same logic as modal)
    CASE 
      WHEN COUNT(DISTINCT mm.material_id) > 1 THEN
        -- Multiple materials: sum everything
        CASE 
          WHEN SUM(mm.panel_count) > 0 THEN
            SUM(mm.actual_material_used) / SUM(mm.panel_count)
          ELSE NULL
        END
      ELSE
        -- Single material: check if should calculate or Machine 3
        CASE 
          WHEN SUM(mm.boards_used) > 1 
            OR (SUM(mm.boards_used) = 0 AND MAX(mm.usage_percentage) >= 65) THEN
            -- Calculate m²/panel for single material
            CASE 
              WHEN SUM(mm.panel_count) > 0 THEN
                SUM(mm.actual_material_used) / SUM(mm.panel_count)
              ELSE NULL
            END
          ELSE
            -- Machine 3 case (no m²/panel calculation)
            NULL
        END
    END as m2_per_panel
  FROM quotes q
  INNER JOIN material_metrics mm ON mm.quote_id = q.id
  WHERE 
    q.status IN ('ordered', 'in_production', 'ready', 'finished')
    AND q.deleted_at IS NULL
  GROUP BY q.id, q.quote_number, q.order_number, q.status, q.created_at
  HAVING SUM(mm.panel_count) > 0 -- Exclude quotes with no panels
),
-- Step 4: Test different threshold values
threshold_tests AS (
  SELECT 
    threshold_value,
    -- Machine 2: m²/panel > threshold (large panels)
    SUM(CASE 
      WHEN NOT is_machine_3 
        AND m2_per_panel IS NOT NULL 
        AND m2_per_panel > threshold_value 
      THEN total_cutting_length 
      ELSE 0 
    END) as machine2_cutting_length,
    -- Machine 1: m²/panel <= threshold (small panels)
    SUM(CASE 
      WHEN NOT is_machine_3 
        AND m2_per_panel IS NOT NULL 
        AND m2_per_panel <= threshold_value 
      THEN total_cutting_length 
      ELSE 0 
    END) as machine1_cutting_length,
    -- Machine 3: special cases
    SUM(CASE 
      WHEN is_machine_3 
      THEN total_cutting_length 
      ELSE 0 
    END) as machine3_cutting_length,
    -- Count orders
    COUNT(CASE WHEN NOT is_machine_3 AND m2_per_panel IS NOT NULL AND m2_per_panel > threshold_value THEN 1 END) as machine2_order_count,
    COUNT(CASE WHEN NOT is_machine_3 AND m2_per_panel IS NOT NULL AND m2_per_panel <= threshold_value THEN 1 END) as machine1_order_count,
    COUNT(CASE WHEN is_machine_3 THEN 1 END) as machine3_order_count
  FROM quote_m2_per_panel
  CROSS JOIN (
    -- Generate threshold values from 0.10 to 0.60 in steps of 0.01
    SELECT generate_series(10, 60, 1)::numeric / 100.0 as threshold_value
  ) thresholds
  GROUP BY threshold_value
),
-- Step 5: Calculate percentages and find optimal threshold
threshold_results AS (
  SELECT 
    threshold_value,
    machine1_cutting_length,
    machine2_cutting_length,
    machine3_cutting_length,
    machine1_order_count,
    machine2_order_count,
    machine3_order_count,
    (machine1_cutting_length + machine2_cutting_length) as total_cutting_length_m1_m2,
    CASE 
      WHEN (machine1_cutting_length + machine2_cutting_length) > 0 
      THEN (machine2_cutting_length * 100.0 / (machine1_cutting_length + machine2_cutting_length))
      ELSE 0
    END as machine2_percentage,
    ABS(
      CASE 
        WHEN (machine1_cutting_length + machine2_cutting_length) > 0 
        THEN (machine2_cutting_length * 100.0 / (machine1_cutting_length + machine2_cutting_length))
        ELSE 0
      END - 60.0
    ) as deviation_from_60_percent
  FROM threshold_tests
  WHERE (machine1_cutting_length + machine2_cutting_length) > 0
)
-- Step 6: Show top 20 results AND best recommendation in one query
SELECT 
  result_type,
  "Threshold",
  "Machine 2 %",
  "Machine 1 %",
  "Machine 2 Cutting (m)",
  "Machine 1 Cutting (m)",
  "Machine 3 Cutting (m)",
  "Total M1+M2 (m)",
  "M2 Orders",
  "M1 Orders",
  "M3 Orders",
  "Deviation from 60%"
FROM (
  SELECT 
    CASE 
      WHEN ROW_NUMBER() OVER (ORDER BY deviation_from_60_percent ASC) = 1 THEN 'BEST'
      ELSE 'Top 20'
    END as result_type,
    threshold_value as "Threshold",
    ROUND(machine2_percentage, 2) as "Machine 2 %",
    ROUND(100 - machine2_percentage, 2) as "Machine 1 %",
    ROUND(machine2_cutting_length, 2) as "Machine 2 Cutting (m)",
    ROUND(machine1_cutting_length, 2) as "Machine 1 Cutting (m)",
    ROUND(machine3_cutting_length, 2) as "Machine 3 Cutting (m)",
    ROUND(total_cutting_length_m1_m2, 2) as "Total M1+M2 (m)",
    machine2_order_count as "M2 Orders",
    machine1_order_count as "M1 Orders",
    machine3_order_count as "M3 Orders",
    ROUND(deviation_from_60_percent, 2) as "Deviation from 60%"
  FROM threshold_results
  ORDER BY deviation_from_60_percent ASC
  LIMIT 21
) ranked_results
ORDER BY 
  CASE WHEN result_type = 'BEST' THEN 0 ELSE 1 END,
  "Deviation from 60%" ASC;

-- =============================================================================
-- BONUS: Show summary statistics
-- =============================================================================
-- Uncomment to see overall statistics
/*
SELECT 
  COUNT(*) as total_orders,
  COUNT(CASE WHEN is_machine_3 THEN 1 END) as machine3_orders,
  COUNT(CASE WHEN NOT is_machine_3 AND m2_per_panel IS NOT NULL THEN 1 END) as orders_with_m2_calculation,
  ROUND(MIN(m2_per_panel), 4) as min_m2_per_panel,
  ROUND(MAX(m2_per_panel), 4) as max_m2_per_panel,
  ROUND(AVG(m2_per_panel), 4) as avg_m2_per_panel,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY m2_per_panel), 4) as median_m2_per_panel,
  ROUND(SUM(total_cutting_length), 2) as total_cutting_length_all_orders,
  ROUND(SUM(CASE WHEN is_machine_3 THEN total_cutting_length ELSE 0 END), 2) as machine3_cutting_length
FROM quote_m2_per_panel
WHERE m2_per_panel IS NOT NULL;
*/
