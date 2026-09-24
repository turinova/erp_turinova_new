-- POS gyors termékek (kurált tile-rács, tenant szint — Lightspeed quick keys mintára)

create table if not exists public.pos_quick_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  accessory_id uuid not null references public.accessories (id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pos_quick_items_tenant_accessory_uidx unique (tenant_id, accessory_id)
);

comment on table public.pos_quick_items is
  'Kurált POS gyorsrács: idle képernyőn 1 tap → kosár. Max 24 app-szinten.';

create index if not exists pos_quick_items_tenant_sort_idx
  on public.pos_quick_items (tenant_id, sort_order);

alter table public.pos_quick_items enable row level security;

drop policy if exists pos_quick_items_select_member on public.pos_quick_items;
create policy pos_quick_items_select_member
  on public.pos_quick_items for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists pos_quick_items_insert_writer on public.pos_quick_items;
create policy pos_quick_items_insert_writer
  on public.pos_quick_items for insert to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists pos_quick_items_update_writer on public.pos_quick_items;
create policy pos_quick_items_update_writer
  on public.pos_quick_items for update to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists pos_quick_items_delete_writer on public.pos_quick_items;
create policy pos_quick_items_delete_writer
  on public.pos_quick_items for delete to authenticated
  using (public.can_write_tenant(tenant_id));
