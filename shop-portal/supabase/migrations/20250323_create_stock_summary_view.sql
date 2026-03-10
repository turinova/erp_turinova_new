-- Create stock_summary materialized view
-- Real-time aggregated stock levels per product per warehouse

CREATE MATERIALIZED VIEW IF NOT EXISTS public.stock_summary AS
SELECT 
  sm.warehouse_id,
  w.name AS warehouse_name,
  sm.product_id,
  p.name AS product_name,
  p.sku,
  p.gtin AS supplier_barcode,
  p.internal_barcode,
  
  -- Current stock levels
  COALESCE(SUM(CASE WHEN sm.movement_type IN ('in', 'transfer_in') THEN sm.quantity ELSE 0 END), 0) -
  COALESCE(SUM(CASE WHEN sm.movement_type IN ('out', 'transfer_out') THEN sm.quantity ELSE 0 END), 0) AS quantity_on_hand,
  
  -- Reserved stock
  COALESCE(SUM(CASE WHEN sm.movement_type = 'reserved' THEN sm.quantity ELSE 0 END), 0) -
  COALESCE(SUM(CASE WHEN sm.movement_type = 'released' THEN sm.quantity ELSE 0 END), 0) AS quantity_reserved,
  
  -- Available stock
  (COALESCE(SUM(CASE WHEN sm.movement_type IN ('in', 'transfer_in') THEN sm.quantity ELSE 0 END), 0) -
   COALESCE(SUM(CASE WHEN sm.movement_type IN ('out', 'transfer_out') THEN sm.quantity ELSE 0 END), 0)) -
  (COALESCE(SUM(CASE WHEN sm.movement_type = 'reserved' THEN sm.quantity ELSE 0 END), 0) -
   COALESCE(SUM(CASE WHEN sm.movement_type = 'released' THEN sm.quantity ELSE 0 END), 0)) AS quantity_available,
  
  -- Average cost (weighted average of IN movements)
  COALESCE(
    SUM(CASE WHEN sm.movement_type IN ('in', 'transfer_in') AND sm.unit_cost IS NOT NULL 
        THEN sm.quantity * sm.unit_cost ELSE 0 END)::NUMERIC /
    NULLIF(SUM(CASE WHEN sm.movement_type IN ('in', 'transfer_in') AND sm.unit_cost IS NOT NULL 
        THEN sm.quantity ELSE 0 END), 0),
    0
  ) AS average_cost,
  
  -- Total value
  (COALESCE(SUM(CASE WHEN sm.movement_type IN ('in', 'transfer_in') THEN sm.quantity ELSE 0 END), 0) -
   COALESCE(SUM(CASE WHEN sm.movement_type IN ('out', 'transfer_out') THEN sm.quantity ELSE 0 END), 0)) *
  COALESCE(
    SUM(CASE WHEN sm.movement_type IN ('in', 'transfer_in') AND sm.unit_cost IS NOT NULL 
        THEN sm.quantity * sm.unit_cost ELSE 0 END)::NUMERIC /
    NULLIF(SUM(CASE WHEN sm.movement_type IN ('in', 'transfer_in') AND sm.unit_cost IS NOT NULL 
        THEN sm.quantity ELSE 0 END), 0),
    0
  ) AS total_value,
  
  -- Last movement
  MAX(sm.created_at) AS last_movement_at
  
FROM public.stock_movements sm
INNER JOIN public.warehouses w ON w.id = sm.warehouse_id
INNER JOIN public.shoprenter_products p ON p.id = sm.product_id
WHERE p.deleted_at IS NULL
GROUP BY sm.warehouse_id, w.name, sm.product_id, p.name, p.sku, p.gtin, p.internal_barcode;

-- Index for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_summary_unique 
ON public.stock_summary(warehouse_id, product_id);

-- Refresh function
CREATE OR REPLACE FUNCTION refresh_stock_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.stock_summary;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON MATERIALIZED VIEW public.stock_summary IS 'Real-time aggregated stock levels per product per warehouse. Refresh manually after stock movements.';
COMMENT ON FUNCTION refresh_stock_summary() IS 'Refresh the stock_summary materialized view. Call after bulk stock movements.';
