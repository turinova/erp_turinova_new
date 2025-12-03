-- PO sorszám generátor szekvencia
CREATE SEQUENCE IF NOT EXISTS purchase_order_number_seq
  INCREMENT BY 1
  MINVALUE 1
  NO MAXVALUE
  START WITH 1
  OWNED BY NONE;

-- PO sorszám generáló függvény
CREATE OR REPLACE FUNCTION generate_purchase_order_number()
RETURNS varchar
LANGUAGE plpgsql
AS $$
DECLARE
  next_val bigint;
BEGIN
  -- Pl.: PO-20251116-000123
  SELECT nextval('purchase_order_number_seq') INTO next_val;

  RETURN 'PO-' ||
         to_char(current_date, 'YYYYMMDD') ||
         '-' ||
         lpad(next_val::text, 6, '0');
END;
$$;
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  po_number varchar(50) NOT NULL UNIQUE DEFAULT generate_purchase_order_number(),

  partner_id uuid NOT NULL
    REFERENCES public.partners (id) ON DELETE RESTRICT,

  warehouse_id uuid NOT NULL
    REFERENCES public.warehouses (id) ON DELETE RESTRICT,

  -- 'stock_replenishment' = raktárra rendelés
  -- 'customer_order'      = később: shop_order_items-ből
  source_type varchar(30) NOT NULL DEFAULT 'stock_replenishment',

  order_date date NOT NULL DEFAULT current_date,
  expected_date date NULL,

  status varchar(20) NOT NULL DEFAULT 'draft',
  -- 'draft' | 'sent' | 'confirmed' | 'received' | 'cancelled'

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,

  note text NULL,

  CONSTRAINT purchase_orders_status_check
    CHECK (status IN ('draft','sent','confirmed','received','cancelled')),

  CONSTRAINT purchase_orders_source_type_check
    CHECK (source_type IN ('stock_replenishment','customer_order'))
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_partner_id
  ON public.purchase_orders (partner_id);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_warehouse_id
  ON public.purchase_orders (warehouse_id);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_status
  ON public.purchase_orders (status);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_order_date
  ON public.purchase_orders (order_date);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_deleted_at
  ON public.purchase_orders (deleted_at)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trigger_update_purchase_orders_updated_at
BEFORE UPDATE ON public.purchase_orders
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  purchase_order_id uuid NOT NULL
    REFERENCES public.purchase_orders (id) ON DELETE CASCADE,

  -- Később: vevői rendelés tételhez kötés (opcionális)
  shop_order_item_id uuid NULL
    REFERENCES public.shop_order_items (id) ON DELETE SET NULL,

  -- Milyen típusú termék (accessory / material / linear_material)
  product_type varchar(30) NOT NULL,
  -- 'accessory' | 'material' | 'linear_material'

  accessory_id uuid NULL
    REFERENCES public.accessories (id) ON DELETE RESTRICT,

  material_id uuid NULL
    REFERENCES public.materials (id) ON DELETE RESTRICT,

  linear_material_id uuid NULL
    REFERENCES public.linear_materials (id) ON DELETE RESTRICT,

  -- Mennyiség és nettó egységár
  quantity numeric(10,2) NOT NULL,
  net_price integer NOT NULL,  -- nettó egységár

  vat_id uuid NOT NULL
    REFERENCES public.vat (id) ON DELETE RESTRICT,

  currency_id uuid NOT NULL
    REFERENCES public.currencies (id) ON DELETE RESTRICT,

  units_id uuid NOT NULL
    REFERENCES public.units (id) ON DELETE RESTRICT,

  -- Szöveges megnevezés (védelem a későbbi terméknév változás ellen)
  description varchar(255) NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,

  note text NULL,

  CONSTRAINT purchase_order_items_product_type_check
    CHECK (product_type IN ('accessory','material','linear_material')),

  CONSTRAINT purchase_order_items_quantity_positive
    CHECK (quantity > 0),

  CONSTRAINT purchase_order_items_net_price_positive
    CHECK (net_price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po_id
  ON public.purchase_order_items (purchase_order_id);

CREATE INDEX IF NOT EXISTS idx_purchase_order_items_shop_order_item_id
  ON public.purchase_order_items (shop_order_item_id);

CREATE INDEX IF NOT EXISTS idx_purchase_order_items_product_type
  ON public.purchase_order_items (product_type);

CREATE INDEX IF NOT EXISTS idx_purchase_order_items_deleted_at
  ON public.purchase_order_items (deleted_at)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trigger_update_purchase_order_items_updated_at
BEFORE UPDATE ON public.purchase_order_items
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
CREATE TABLE IF NOT EXISTS public.shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  purchase_order_id uuid NOT NULL
    REFERENCES public.purchase_orders (id) ON DELETE CASCADE,

  warehouse_id uuid NOT NULL
    REFERENCES public.warehouses (id) ON DELETE RESTRICT,

  partner_id uuid NOT NULL
    REFERENCES public.partners (id) ON DELETE RESTRICT,

  shipment_date date NOT NULL DEFAULT current_date,

  status varchar(20) NOT NULL DEFAULT 'draft',
  -- 'draft' | 'received' | 'cancelled'

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,

  note text NULL,

  CONSTRAINT shipments_status_check
    CHECK (status IN ('draft','received','cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_shipments_purchase_order_id
  ON public.shipments (purchase_order_id);

CREATE INDEX IF NOT EXISTS idx_shipments_warehouse_id
  ON public.shipments (warehouse_id);

CREATE INDEX IF NOT EXISTS idx_shipments_partner_id
  ON public.shipments (partner_id);

CREATE INDEX IF NOT EXISTS idx_shipments_status
  ON public.shipments (status);

CREATE INDEX IF NOT EXISTS idx_shipments_deleted_at
  ON public.shipments (deleted_at)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trigger_update_shipments_updated_at
BEFORE UPDATE ON public.shipments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
CREATE TABLE IF NOT EXISTS public.shipment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  shipment_id uuid NOT NULL
    REFERENCES public.shipments (id) ON DELETE CASCADE,

  purchase_order_item_id uuid NOT NULL
    REFERENCES public.purchase_order_items (id) ON DELETE RESTRICT,

  quantity_received numeric(10,2) NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,

  note text NULL,

  CONSTRAINT shipment_items_quantity_positive
    CHECK (quantity_received > 0)
);

CREATE INDEX IF NOT EXISTS idx_shipment_items_shipment_id
  ON public.shipment_items (shipment_id);

CREATE INDEX IF NOT EXISTS idx_shipment_items_po_item_id
  ON public.shipment_items (purchase_order_item_id);

CREATE INDEX IF NOT EXISTS idx_shipment_items_deleted_at
  ON public.shipment_items (deleted_at)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trigger_update_shipment_items_updated_at
BEFORE UPDATE ON public.shipment_items
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  warehouse_id uuid NOT NULL
    REFERENCES public.warehouses (id) ON DELETE RESTRICT,

  product_type varchar(30) NOT NULL,
  -- 'accessory' | 'material' | 'linear_material'

  accessory_id uuid NULL
    REFERENCES public.accessories (id) ON DELETE RESTRICT,

  material_id uuid NULL
    REFERENCES public.materials (id) ON DELETE RESTRICT,

  linear_material_id uuid NULL
    REFERENCES public.linear_materials (id) ON DELETE RESTRICT,

  -- Pozitív = bejövő, negatív = kimenő
  quantity numeric(10,2) NOT NULL,

  movement_type varchar(20) NOT NULL,
  -- 'in' | 'out' | 'adjustment'

  source_type varchar(30) NOT NULL,
  -- pl.: 'purchase_receipt' (most ezt fogod használni elsőnek)

  source_id uuid NULL,
  -- hivatkozhat pl. shipment.id-re purchase_receipt esetén

  created_at timestamptz NOT NULL DEFAULT now(),
  note text NULL,

  CONSTRAINT stock_movements_product_type_check
    CHECK (product_type IN ('accessory','material','linear_material')),

  CONSTRAINT stock_movements_movement_type_check
    CHECK (movement_type IN ('in','out','adjustment')),

  CONSTRAINT stock_movements_quantity_nonzero
    CHECK (quantity <> 0)
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_warehouse
  ON public.stock_movements (warehouse_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product_type
  ON public.stock_movements (product_type);

CREATE INDEX IF NOT EXISTS idx_stock_movements_accessory_id
  ON public.stock_movements (accessory_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_material_id
  ON public.stock_movements (material_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_linear_material_id
  ON public.stock_movements (linear_material_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_source
  ON public.stock_movements (source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at
  ON public.stock_movements (created_at);
