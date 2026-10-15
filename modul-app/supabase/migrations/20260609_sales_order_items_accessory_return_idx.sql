-- POS termék-első visszáru: gyors lookup accessory → eladási sorok
create index if not exists sales_order_items_accessory_return_idx
  on public.sales_order_items (tenant_id, accessory_id)
  where deleted_at is null and item_kind = 'product' and accessory_id is not null;
