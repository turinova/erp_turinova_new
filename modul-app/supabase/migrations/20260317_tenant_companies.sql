-- modul-app: tenant company profile (Cégadatok)
-- 1:1 a tenants-szel. Futtasd a tenancy foundation után.
-- V1: main-app tenant_company mezőparitás + logo storage.

create table if not exists public.tenant_companies (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,

  name text not null,
  country text not null default 'Magyarország',
  postal_code text,
  city text,
  address text,
  phone_number text,
  email text,
  website text,
  tax_number text,
  company_registration_number text,
  vat_id text,
  logo_url text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tenant_companies_name_idx
  on public.tenant_companies (lower(name));

alter table public.tenant_companies enable row level security;

drop policy if exists tenant_companies_select_member on public.tenant_companies;
create policy tenant_companies_select_member
  on public.tenant_companies
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists tenant_companies_insert_writer on public.tenant_companies;
create policy tenant_companies_insert_writer
  on public.tenant_companies
  for insert
  to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists tenant_companies_update_writer on public.tenant_companies;
create policy tenant_companies_update_writer
  on public.tenant_companies
  for update
  to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists tenant_companies_delete_writer on public.tenant_companies;
create policy tenant_companies_delete_writer
  on public.tenant_companies
  for delete
  to authenticated
  using (public.can_write_tenant(tenant_id));

comment on table public.tenant_companies is
  'Cégadatok profil tenantonként (PDF/SMS később; V1: szerkesztő űrlap)';

-- Topbar név szinkron: writer frissítheti a tenants.name-et
drop policy if exists tenants_update_writer on public.tenants;
create policy tenants_update_writer
  on public.tenants
  for update
  to authenticated
  using (public.can_write_tenant(id))
  with check (public.can_write_tenant(id));

-- ---------------------------------------------------------------------------
-- Storage: tenant-company-logos ({tenant_id}/logo.*)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tenant-company-logos',
  'tenant-company-logos',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists tenant_company_logos_storage_select on storage.objects;
create policy tenant_company_logos_storage_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'tenant-company-logos'
    and public.is_tenant_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists tenant_company_logos_storage_insert on storage.objects;
create policy tenant_company_logos_storage_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'tenant-company-logos'
    and public.can_write_tenant(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists tenant_company_logos_storage_update on storage.objects;
create policy tenant_company_logos_storage_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'tenant-company-logos'
    and public.can_write_tenant(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'tenant-company-logos'
    and public.can_write_tenant(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists tenant_company_logos_storage_delete on storage.objects;
create policy tenant_company_logos_storage_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'tenant-company-logos'
    and public.can_write_tenant(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists tenant_company_logos_storage_public_read on storage.objects;
create policy tenant_company_logos_storage_public_read
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'tenant-company-logos');
