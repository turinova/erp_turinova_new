-- Add 'deleted' status to shop_orders table
ALTER TABLE public.shop_orders 
DROP CONSTRAINT shop_orders_status_check;

ALTER TABLE public.shop_orders 
ADD CONSTRAINT shop_orders_status_check CHECK (
  (status)::text = ANY (
    ARRAY[
      'open'::character varying,
      'ordered'::character varying,
      'finished'::character varying,
      'deleted'::character varying
    ]::text[]
  )
);

-- Add 'deleted' status to shop_order_items table
ALTER TABLE public.shop_order_items 
DROP CONSTRAINT shop_order_items_status_check;

ALTER TABLE public.shop_order_items 
ADD CONSTRAINT shop_order_items_status_check CHECK (
  (status)::text = ANY (
    ARRAY[
      'open'::character varying,
      'ordered'::character varying,
      'arrived'::character varying,
      'deleted'::character varying
    ]::text[]
  )
);
