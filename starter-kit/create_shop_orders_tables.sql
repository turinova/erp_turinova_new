-- Create shop orders and order items tables with performance optimization
-- Run this SQL manually

-- Create sequence for order numbers
CREATE SEQUENCE IF NOT EXISTS shop_order_number_seq START 1;

-- Create shop_orders table
CREATE TABLE IF NOT EXISTS shop_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number varchar(50) UNIQUE NOT NULL,
  worker_id uuid NOT NULL REFERENCES workers(id),
  customer_name varchar(255) NOT NULL,
  customer_email varchar(255),
  customer_mobile varchar(50),
  customer_discount decimal(5,2) DEFAULT 0,
  billing_name varchar(255),
  billing_country varchar(100),
  billing_city varchar(100),
  billing_postal_code varchar(20),
  billing_street varchar(255),
  billing_house_number varchar(20),
  billing_tax_number varchar(50),
  billing_company_reg_number varchar(50),
  status varchar(20) DEFAULT 'open' CHECK (status IN ('open', 'ordered', 'finished')),
  created_at timestamp with time zone DEFAULT NOW(),
  updated_at timestamp with time zone DEFAULT NOW(),
  deleted_at timestamp with time zone NULL
);

-- Create shop_order_items table
CREATE TABLE IF NOT EXISTS shop_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES shop_orders(id) ON DELETE CASCADE,
  product_name varchar(255) NOT NULL,
  sku varchar(100),
  type varchar(100),
  base_price integer NOT NULL,
  multiplier decimal(3,2) DEFAULT 1.38,
  quantity integer NOT NULL,
  units_id uuid REFERENCES units(id),
  partner_id uuid REFERENCES partners(id),
  vat_id uuid REFERENCES vat(id),
  currency_id uuid REFERENCES currencies(id),
  megjegyzes text,
  status varchar(20) DEFAULT 'open' CHECK (status IN ('open', 'ordered', 'arrived')),
  created_at timestamp with time zone DEFAULT NOW(),
  updated_at timestamp with time zone DEFAULT NOW(),
  deleted_at timestamp with time zone NULL
);

-- Performance indexes for shop_orders
CREATE INDEX IF NOT EXISTS idx_shop_orders_order_number ON shop_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_shop_orders_worker_id ON shop_orders(worker_id);
CREATE INDEX IF NOT EXISTS idx_shop_orders_status ON shop_orders(status);
CREATE INDEX IF NOT EXISTS idx_shop_orders_created_at ON shop_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_shop_orders_deleted_at ON shop_orders(deleted_at) WHERE deleted_at IS NULL;

-- Performance indexes for shop_order_items
CREATE INDEX IF NOT EXISTS idx_shop_order_items_order_id ON shop_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_shop_order_items_partner_id ON shop_order_items(partner_id);
CREATE INDEX IF NOT EXISTS idx_shop_order_items_status ON shop_order_items(status);
CREATE INDEX IF NOT EXISTS idx_shop_order_items_deleted_at ON shop_order_items(deleted_at) WHERE deleted_at IS NULL;

-- Function to generate order number
CREATE OR REPLACE FUNCTION generate_shop_order_number()
RETURNS TEXT AS $$
DECLARE
    next_num INTEGER;
    order_num TEXT;
BEGIN
    SELECT nextval('shop_order_number_seq') INTO next_num;
    order_num := 'SO-' || EXTRACT(YEAR FROM NOW()) || '-' || LPAD(next_num::TEXT, 3, '0');
    RETURN order_num;
END;
$$ LANGUAGE plpgsql;

-- Function to update order status based on item statuses
CREATE OR REPLACE FUNCTION update_shop_order_status()
RETURNS TRIGGER AS $$
DECLARE
    order_status TEXT;
    open_count INTEGER;
    ordered_count INTEGER;
    arrived_count INTEGER;
    total_count INTEGER;
BEGIN
    -- Count statuses for the order
    SELECT 
        COUNT(*) FILTER (WHERE status = 'open' AND deleted_at IS NULL),
        COUNT(*) FILTER (WHERE status = 'ordered' AND deleted_at IS NULL),
        COUNT(*) FILTER (WHERE status = 'arrived' AND deleted_at IS NULL),
        COUNT(*) FILTER (WHERE deleted_at IS NULL)
    INTO open_count, ordered_count, arrived_count, total_count
    FROM shop_order_items 
    WHERE order_id = COALESCE(NEW.order_id, OLD.order_id);
    
    -- Determine order status
    IF total_count = 0 THEN
        order_status := 'open';
    ELSIF arrived_count = total_count THEN
        order_status := 'finished';
    ELSIF ordered_count + arrived_count = total_count THEN
        order_status := 'ordered';
    ELSE
        order_status := 'open';
    END IF;
    
    -- Update order status
    UPDATE shop_orders 
    SET status = order_status, updated_at = NOW()
    WHERE id = COALESCE(NEW.order_id, OLD.order_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update order status when items change
CREATE TRIGGER trigger_update_shop_order_status
    AFTER INSERT OR UPDATE OR DELETE ON shop_order_items
    FOR EACH ROW
    EXECUTE FUNCTION update_shop_order_status();
