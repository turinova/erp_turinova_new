-- Média könyvtár + termék image_url + oldaljog

-- ---------------------------------------------------------------------------
-- media_files
-- ---------------------------------------------------------------------------
create table if not exists public.media_files (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  original_filename text not null,
  stored_filename text not null,
  storage_path text not null,
  public_url text not null,
  size_bytes bigint not null check (size_bytes > 0),
  mime_type text not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists media_files_tenant_filename_uidx
  on public.media_files (tenant_id, lower(original_filename));

create index if not exists media_files_tenant_created_idx
  on public.media_files (tenant_id, created_at desc);

create index if not exists media_files_tenant_url_idx
  on public.media_files (tenant_id, public_url);

alter table public.media_files enable row level security;

drop policy if exists media_files_select_member on public.media_files;
create policy media_files_select_member
  on public.media_files
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists media_files_insert_writer on public.media_files;
create policy media_files_insert_writer
  on public.media_files
  for insert
  to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists media_files_update_writer on public.media_files;
create policy media_files_update_writer
  on public.media_files
  for update
  to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists media_files_delete_writer on public.media_files;
create policy media_files_delete_writer
  on public.media_files
  for delete
  to authenticated
  using (public.can_write_tenant(tenant_id));

comment on table public.media_files is
  'Tenant média könyvtár — original_filename Excel/match kulcs';

-- ---------------------------------------------------------------------------
-- Storage: tenant-media
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tenant-media',
  'tenant-media',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists tenant_media_storage_select on storage.objects;
create policy tenant_media_storage_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'tenant-media'
    and public.is_tenant_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists tenant_media_storage_insert on storage.objects;
create policy tenant_media_storage_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'tenant-media'
    and public.can_write_tenant(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists tenant_media_storage_update on storage.objects;
create policy tenant_media_storage_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'tenant-media'
    and public.can_write_tenant(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'tenant-media'
    and public.can_write_tenant(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists tenant_media_storage_delete on storage.objects;
create policy tenant_media_storage_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'tenant-media'
    and public.can_write_tenant(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists tenant_media_storage_public_read on storage.objects;
create policy tenant_media_storage_public_read
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'tenant-media');

-- ---------------------------------------------------------------------------
-- accessories.image_url
-- ---------------------------------------------------------------------------
alter table public.accessories
  add column if not exists image_url text;

comment on column public.accessories.image_url is
  'Publikus kép URL (tenant-media vagy legacy bucket)';

-- ---------------------------------------------------------------------------
-- Page access: Média (Rendszer alatt)
-- ---------------------------------------------------------------------------
insert into public.product_features (key, label, category, page_key, sort_order)
values
  (
    '/torzsadatok/rendszer/media',
    'Média',
    'Törzsadatok',
    '/torzsadatok/rendszer/media',
    95
  )
on conflict (key) do update
set
  label = excluded.label,
  category = excluded.category,
  page_key = excluded.page_key,
  sort_order = excluded.sort_order,
  active = true;

-- Régi path (/torzsadatok/media) → új, ha korábbi migráció már lefutott
insert into public.product_plan_features (plan_id, feature_key)
select ppf.plan_id, '/torzsadatok/rendszer/media'
from public.product_plan_features ppf
where ppf.feature_key = '/torzsadatok/media'
on conflict do nothing;

insert into public.tenant_entitlements (tenant_id, feature_key)
select te.tenant_id, '/torzsadatok/rendszer/media'
from public.tenant_entitlements te
where te.feature_key = '/torzsadatok/media'
on conflict do nothing;

insert into public.tenant_membership_page_access (
  tenant_id,
  membership_id,
  page_key,
  can_access
)
select
  a.tenant_id,
  a.membership_id,
  '/torzsadatok/rendszer/media',
  a.can_access
from public.tenant_membership_page_access a
where a.page_key = '/torzsadatok/media'
on conflict (membership_id, page_key) do update
set
  can_access = excluded.can_access,
  updated_at = now();

update public.product_features
set active = false
where key = '/torzsadatok/media';

insert into public.product_plan_features (plan_id, feature_key)
select p.id, '/torzsadatok/rendszer/media'
from public.product_plans p
where p.key = 'alap'
on conflict do nothing;

insert into public.tenant_entitlements (tenant_id, feature_key)
select t.id, '/torzsadatok/rendszer/media'
from public.tenants t
on conflict do nothing;

-- Minden aktív tagság kapjon média oldalt (új törzsadat — ne essen ki a menüből)
insert into public.tenant_membership_page_access (
  tenant_id,
  membership_id,
  page_key,
  can_access
)
select
  m.tenant_id,
  m.id,
  '/torzsadatok/rendszer/media',
  true
from public.tenant_memberships m
on conflict (membership_id, page_key) do update
set
  can_access = true,
  updated_at = now();
