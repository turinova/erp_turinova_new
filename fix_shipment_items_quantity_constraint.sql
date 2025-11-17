-- Update shipment_items constraint to allow quantity_received = 0
-- This allows pre-populating items with 0 quantity when shipment is created

ALTER TABLE public.shipment_items
  DROP CONSTRAINT IF EXISTS shipment_items_quantity_positive;

ALTER TABLE public.shipment_items
  ADD CONSTRAINT shipment_items_quantity_nonnegative
    CHECK (quantity_received >= 0);

