-- ============================================
-- Material Inventory Tracking System - Phase 1: Bevételezés
-- ============================================
-- Date: 2025-10-31
-- Purpose: Track material inventory movements with cost tracking (average cost method)
-- Phase: 1 - Inbound only (bevételezés when shop_order_items arrive)
-- Run this SQL manually in Supabase

-- ============================================
-- 1. Create inventory transactions table
-- ============================================

CREATE TABLE IF NOT EXISTS public.material_inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Material identification
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
  sku VARCHAR(100) NOT NULL, -- Denormalized machine_code for fast lookups
  
  -- Transaction details
  transaction_type VARCHAR(20) NOT NULL CHECK (
    transaction_type IN ('in', 'out', 'reserved', 'released')
  ),
  quantity INTEGER NOT NULL, -- Boards count (positive for 'in', negative for 'out')
  unit_price INTEGER NULL, -- Price per board in base currency (Ft)
  
  -- Reference to source document
  reference_type VARCHAR(30) NOT NULL CHECK (
    reference_type IN ('shop_order_item', 'quote', 'manual')
  ),
  reference_id UUID NOT NULL, -- ID of the source document
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  comment TEXT NULL,
  
  -- Constraints
  CONSTRAINT check_quantity_sign CHECK (
    (transaction_type = 'in' AND quantity > 0) OR
    (transaction_type = 'out' AND quantity < 0) OR
    (transaction_type IN ('reserved', 'released') AND quantity > 0)
  ),
  CONSTRAINT check_price_required CHECK (
    (transaction_type IN ('in', 'out') AND unit_price IS NOT NULL) OR
    (transaction_type IN ('reserved', 'released') AND unit_price IS NULL)
  )
);

-- ============================================
-- 2. Create indexes for performance
-- ============================================

CREATE INDEX idx_mit_material_id ON material_inventory_transactions(material_id);
CREATE INDEX idx_mit_sku ON material_inventory_transactions(sku);
CREATE INDEX idx_mit_transaction_type ON material_inventory_transactions(transaction_type);
CREATE INDEX idx_mit_reference ON material_inventory_transactions(reference_type, reference_id);
CREATE INDEX idx_mit_created_at ON material_inventory_transactions(created_at DESC);

-- Composite index for common queries
CREATE INDEX idx_mit_material_type ON material_inventory_transactions(material_id, transaction_type);

-- ============================================
-- 3. Add comments for documentation
-- ============================================

COMMENT ON TABLE material_inventory_transactions IS 
  'Soft inventory tracking for materials using transaction log approach. Each row represents a movement (in/out/reserved/released). Phase 1: bevételezés only.';
  
COMMENT ON COLUMN material_inventory_transactions.sku IS 
  'Denormalized machine_code from machine_material_map for fast queries without joins';
  
COMMENT ON COLUMN material_inventory_transactions.quantity IS 
  'Number of boards: positive for IN, negative for OUT, positive absolute value for RESERVED/RELEASED';

COMMENT ON COLUMN material_inventory_transactions.unit_price IS
  'Price per board at transaction time. Required for IN/OUT, NULL for RESERVED/RELEASED. Used for average cost calculation.';
  
COMMENT ON COLUMN material_inventory_transactions.reference_type IS 
  'Type of source document: shop_order_item (bevételezés), quote (foglalás/kivételezés), manual (corrections)';

-- ============================================
-- 4. Create inventory summary view
-- ============================================

CREATE OR REPLACE VIEW public.material_inventory_summary AS
SELECT 
  m.id AS material_id,
  m.name AS material_name,
  mmm.machine_code AS sku,
  b.name AS brand_name,
  m.length_mm,
  m.width_mm,
  m.thickness_mm,
  
  -- On hand stock (physical inventory)
  COALESCE(SUM(
    CASE 
      WHEN mit.transaction_type IN ('in', 'out') 
      THEN mit.quantity 
      ELSE 0 
    END
  ), 0) AS quantity_on_hand,
  
  -- Reserved stock (allocated to production)
  COALESCE(SUM(
    CASE 
      WHEN mit.transaction_type = 'reserved' 
      THEN mit.quantity
      WHEN mit.transaction_type = 'released'
      THEN -mit.quantity
      ELSE 0 
    END
  ), 0) AS quantity_reserved,
  
  -- Available stock (on_hand - reserved)
  COALESCE(SUM(
    CASE 
      WHEN mit.transaction_type IN ('in', 'out') 
      THEN mit.quantity 
      ELSE 0 
    END
  ), 0) - COALESCE(SUM(
    CASE 
      WHEN mit.transaction_type = 'reserved' 
      THEN mit.quantity
      WHEN mit.transaction_type = 'released'
      THEN -mit.quantity
      ELSE 0 
    END
  ), 0) AS quantity_available,
  
  -- Average cost per board (weighted average of all IN transactions)
  COALESCE(
    SUM(CASE WHEN mit.transaction_type = 'in' THEN mit.quantity * mit.unit_price ELSE 0 END)::NUMERIC /
    NULLIF(SUM(CASE WHEN mit.transaction_type = 'in' THEN mit.quantity ELSE 0 END), 0),
    0
  ) AS average_cost_per_board,
  
  -- Total inventory value (on_hand × average_cost)
  COALESCE(
    (SUM(CASE WHEN mit.transaction_type IN ('in', 'out') THEN mit.quantity ELSE 0 END) *
    (SUM(CASE WHEN mit.transaction_type = 'in' THEN mit.quantity * mit.unit_price ELSE 0 END)::NUMERIC /
     NULLIF(SUM(CASE WHEN mit.transaction_type = 'in' THEN mit.quantity ELSE 0 END), 0))),
    0
  ) AS total_inventory_value,
  
  -- Last movement timestamp
  MAX(mit.created_at) AS last_movement_at
  
FROM materials m
INNER JOIN machine_material_map mmm 
  ON mmm.material_id = m.id 
  AND mmm.machine_type = 'Korpus'
LEFT JOIN brands b ON b.id = m.brand_id
LEFT JOIN material_inventory_transactions mit 
  ON mit.material_id = m.id
WHERE m.deleted_at IS NULL
GROUP BY m.id, m.name, mmm.machine_code, b.name, m.length_mm, m.width_mm, m.thickness_mm;

COMMENT ON VIEW material_inventory_summary IS 
  'Real-time inventory summary per material. Aggregates transactions to show current stock levels with average cost valuation.';

-- ============================================
-- 5. Example queries for testing
-- ============================================

-- Check inventory for a specific material
-- SELECT * FROM material_inventory_summary WHERE sku = 'U999';

-- See all movements for a material
-- SELECT * FROM material_inventory_transactions WHERE sku = 'U999' ORDER BY created_at DESC;

-- Calculate total inventory value
-- SELECT SUM(total_inventory_value) AS total_value FROM material_inventory_summary;

-- Find materials with low stock
-- SELECT * FROM material_inventory_summary WHERE quantity_available < 5 ORDER BY quantity_available;

-- Recent arrivals (last 20)
-- SELECT * FROM material_inventory_transactions WHERE transaction_type = 'in' ORDER BY created_at DESC LIMIT 20;

-- Materials with no inventory transactions yet
-- SELECT m.name, mmm.machine_code 
-- FROM materials m
-- INNER JOIN machine_material_map mmm ON mmm.material_id = m.id
-- LEFT JOIN material_inventory_transactions mit ON mit.material_id = m.id
-- WHERE m.deleted_at IS NULL AND mit.id IS NULL;

