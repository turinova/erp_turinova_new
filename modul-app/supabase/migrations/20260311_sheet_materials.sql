-- modul-app: tenant-scoped sheet materials (Táblás anyagok)
-- Futtasd: manufacturers + tax_rates + equipment után.
-- Nincs élzáró hozzárendelés (szándékos — soha).

create table if not exists public.sheet_materials (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  manufacturer_id uuid not null references public.manufacturers (id),
  tax_rate_id uuid not null references public.tax_rates (id),
  equipment_id uuid not null references public.equipment (id),

  name text not null,
  length_mm integer not null check (length_mm > 0),
  width_mm integer not null check (width_mm > 0),
  thickness_mm numeric(8, 2) not null check (thickness_mm > 0),

  on_stock boolean not null default true,
  active boolean not null default true,
  image_url text,

  -- Optimalizálás
  trim_top_mm integer not null default 0 check (trim_top_mm >= 0),
  trim_right_mm integer not null default 0 check (trim_right_mm >= 0),
  trim_bottom_mm integer not null default 0 check (trim_bottom_mm >= 0),
  trim_left_mm integer not null default 0 check (trim_left_mm >= 0),
  kerf_mm integer not null default 3 check (kerf_mm >= 0),
  waste_multi numeric(4, 2) not null default 1.20 check (waste_multi > 0),
  usage_limit numeric(3, 2) not null default 0.65
    check (usage_limit >= 0 and usage_limit <= 1),
  grain_direction boolean not null default false,
  rotatable boolean not null default true,

  -- Ár: nettó Ft/m² (UI bruttót szerkeszt)
  price_net numeric(12, 0) not null check (price_net >= 0),

  -- Export
  machine_code text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists sheet_materials_tenant_alive_idx
  on public.sheet_materials (tenant_id)
  where deleted_at is null;

create index if not exists sheet_materials_tenant_active_idx
  on public.sheet_materials (tenant_id, active)
  where deleted_at is null;

create index if not exists sheet_materials_equipment_id_idx
  on public.sheet_materials (equipment_id)
  where deleted_at is null;

create unique index if not exists sheet_materials_identity_alive_uidx
  on public.sheet_materials (
    tenant_id,
    manufacturer_id,
    lower(name),
    length_mm,
    width_mm,
    thickness_mm
  )
  where deleted_at is null;

alter table public.sheet_materials enable row level security;

drop policy if exists sheet_materials_select_member on public.sheet_materials;
create policy sheet_materials_select_member
  on public.sheet_materials
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists sheet_materials_insert_writer on public.sheet_materials;
create policy sheet_materials_insert_writer
  on public.sheet_materials
  for insert
  to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists sheet_materials_update_writer on public.sheet_materials;
create policy sheet_materials_update_writer
  on public.sheet_materials
  for update
  to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists sheet_materials_delete_writer on public.sheet_materials;
create policy sheet_materials_delete_writer
  on public.sheet_materials
  for delete
  to authenticated
  using (public.can_write_tenant(tenant_id));

comment on table public.sheet_materials is 'Táblás anyagok törzs tenantonként (nincs élzáró link)';
comment on column public.sheet_materials.price_net is 'Nettó Ft/m²; UI bruttót szerkeszt';
comment on column public.sheet_materials.usage_limit is 'Kihasználtság küszöb 0–1 (UI: %)';
comment on column public.sheet_materials.image_url is 'Publikus storage URL (sheet-materials bucket)';
comment on column public.sheet_materials.equipment_id is 'Export berendezés';
comment on column public.sheet_materials.machine_code is 'Export gépkód';

-- ---------------------------------------------------------------------------
-- Storage: sheet-materials bucket (tenant mappa prefix: {tenant_id}/...)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sheet-materials',
  'sheet-materials',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists sheet_materials_storage_select on storage.objects;
create policy sheet_materials_storage_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'sheet-materials'
    and public.is_tenant_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists sheet_materials_storage_insert on storage.objects;
create policy sheet_materials_storage_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'sheet-materials'
    and public.can_write_tenant(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists sheet_materials_storage_update on storage.objects;
create policy sheet_materials_storage_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'sheet-materials'
    and public.can_write_tenant(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'sheet-materials'
    and public.can_write_tenant(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists sheet_materials_storage_delete on storage.objects;
create policy sheet_materials_storage_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'sheet-materials'
    and public.can_write_tenant(((storage.foldername(name))[1])::uuid)
  );

-- Publikus bucket: anon/authenticated read a public URL-hez
drop policy if exists sheet_materials_storage_public_read on storage.objects;
create policy sheet_materials_storage_public_read
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'sheet-materials');
