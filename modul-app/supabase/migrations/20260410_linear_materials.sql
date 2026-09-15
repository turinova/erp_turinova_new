-- modul-app: tenant-scoped linear materials (Szálas anyagok)
-- Nincs élzáró hozzárendelés; nincs nesting optimalizálás.
-- Ár: nettó Ft/m (UI bruttót szerkeszt), mint a táblás Ft/m².

create table if not exists public.linear_materials (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  manufacturer_id uuid not null references public.manufacturers (id),
  tax_rate_id uuid not null references public.tax_rates (id),

  name text not null,
  material_type text not null
    check (material_type in ('hatfal', 'munkalap', 'asztalap')),
  length_mm integer not null check (length_mm > 0),
  width_mm integer not null check (width_mm > 0),
  thickness_mm numeric(8, 2) not null check (thickness_mm > 0),

  on_stock boolean not null default true,
  active boolean not null default true,
  image_url text,

  -- Ár: nettó Ft/m (UI bruttót szerkeszt)
  price_net numeric(12, 0) not null check (price_net >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists linear_materials_tenant_alive_idx
  on public.linear_materials (tenant_id)
  where deleted_at is null;

create index if not exists linear_materials_tenant_active_idx
  on public.linear_materials (tenant_id, active)
  where deleted_at is null;

create unique index if not exists linear_materials_identity_alive_uidx
  on public.linear_materials (
    tenant_id,
    manufacturer_id,
    material_type,
    lower(name),
    length_mm,
    width_mm,
    thickness_mm
  )
  where deleted_at is null;

alter table public.linear_materials enable row level security;

drop policy if exists linear_materials_select_member on public.linear_materials;
create policy linear_materials_select_member
  on public.linear_materials
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists linear_materials_insert_writer on public.linear_materials;
create policy linear_materials_insert_writer
  on public.linear_materials
  for insert
  to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists linear_materials_update_writer on public.linear_materials;
create policy linear_materials_update_writer
  on public.linear_materials
  for update
  to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists linear_materials_delete_writer on public.linear_materials;
create policy linear_materials_delete_writer
  on public.linear_materials
  for delete
  to authenticated
  using (public.can_write_tenant(tenant_id));

comment on table public.linear_materials is 'Szálas anyagok törzs (Hátfal / Munkalap / Asztalap)';
comment on column public.linear_materials.price_net is 'Nettó Ft/m; UI bruttót szerkeszt';
comment on column public.linear_materials.material_type is 'hatfal | munkalap | asztalap';

-- Feature catalog (entitlements)
insert into public.product_features (key, label, category, page_key, sort_order)
values
  (
    '/torzsadatok/alapanyagok/szalas-anyagok',
    'Szálas anyagok',
    'Törzsadatok',
    '/torzsadatok/alapanyagok/szalas-anyagok',
    75
  )
on conflict (key) do update
set
  label = excluded.label,
  category = excluded.category,
  page_key = excluded.page_key,
  sort_order = excluded.sort_order;

-- Attach to Alap plan + meglévő tenant entitlements
insert into public.product_plan_features (plan_id, feature_key)
select p.id, '/torzsadatok/alapanyagok/szalas-anyagok'
from public.product_plans p
where p.key = 'alap'
on conflict do nothing;

insert into public.tenant_entitlements (tenant_id, feature_key)
select t.id, '/torzsadatok/alapanyagok/szalas-anyagok'
from public.tenants t
where t.plan_id in (select id from public.product_plans where key = 'alap')
on conflict do nothing;

-- Storage bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'linear-materials',
  'linear-materials',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists linear_materials_storage_select on storage.objects;
create policy linear_materials_storage_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'linear-materials'
    and public.is_tenant_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists linear_materials_storage_insert on storage.objects;
create policy linear_materials_storage_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'linear-materials'
    and public.can_write_tenant(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists linear_materials_storage_update on storage.objects;
create policy linear_materials_storage_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'linear-materials'
    and public.can_write_tenant(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'linear-materials'
    and public.can_write_tenant(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists linear_materials_storage_delete on storage.objects;
create policy linear_materials_storage_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'linear-materials'
    and public.can_write_tenant(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists linear_materials_storage_public_read on storage.objects;
create policy linear_materials_storage_public_read
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'linear-materials');
