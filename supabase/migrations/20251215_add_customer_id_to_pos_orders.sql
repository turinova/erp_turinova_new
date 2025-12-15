-- Add customer_id to pos_orders to store customer FK
alter table public.pos_orders
  add column if not exists customer_id uuid references public.customers (id);

-- Ensure updated_at still maintained via existing triggers (if any)

