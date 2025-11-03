-- Change shop_order_items quantity from integer to numeric to support decimal quantities
-- This allows storing quantities like 2.5, 1.75, etc. for items that are measured in decimal units

ALTER TABLE shop_order_items 
ALTER COLUMN quantity TYPE numeric(10, 2);

COMMENT ON COLUMN shop_order_items.quantity IS 'Quantity with support for 2 decimal places (e.g., 2.50, 1.75)';

