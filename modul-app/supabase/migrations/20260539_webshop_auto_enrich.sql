-- Webshop auto-enrich: tenant csomag default + seed upsert

create table if not exists public.tenant_webshop_settings (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  default_shipping_weight_kg numeric(12, 3) not null default 0.25,
  default_shipping_length_cm numeric(12, 2) not null default 20,
  default_shipping_width_cm numeric(12, 2) not null default 12,
  default_shipping_height_cm numeric(12, 2) not null default 6,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.tenant_webshop_settings is
  'Webshop tenant defaultok — üres termék shipping mezőket innen töltjük.';

alter table public.tenant_webshop_settings enable row level security;

drop policy if exists tenant_webshop_settings_select on public.tenant_webshop_settings;
drop policy if exists tenant_webshop_settings_write on public.tenant_webshop_settings;
drop policy if exists tenant_webshop_settings_insert on public.tenant_webshop_settings;
drop policy if exists tenant_webshop_settings_update on public.tenant_webshop_settings;

create policy tenant_webshop_settings_select
  on public.tenant_webshop_settings for select to authenticated
  using (public.is_tenant_member(tenant_id));

create policy tenant_webshop_settings_insert
  on public.tenant_webshop_settings for insert to authenticated
  with check (public.can_write_tenant(tenant_id));

create policy tenant_webshop_settings_update
  on public.tenant_webshop_settings for update to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

create or replace function public.seed_webshop_defaults_for_tenant(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.web_categories (tenant_id, name, sort_order, google_taxonomy_id)
  select p_tenant_id, v.name, v.sort_order, v.google_taxonomy_id
  from (
    values
      ('Vasalat', 10, '4696'),
      ('Fogantyú', 20, '4700'),
      ('Zsanér', 30, '1771'),
      ('Fiókcsúszó', 40, '8470'),
      ('Egyéb', 100, '4696')
  ) as v(name, sort_order, google_taxonomy_id)
  where not exists (
    select 1 from public.web_categories c
    where c.tenant_id = p_tenant_id
      and c.deleted_at is null
      and lower(c.name) = lower(v.name)
      and c.parent_id is null
  );

  update public.web_categories c
  set
    google_taxonomy_id = v.google_taxonomy_id,
    updated_at = now()
  from (
    values
      ('Vasalat', '4696'),
      ('Fogantyú', '4700'),
      ('Zsanér', '1771'),
      ('Fiókcsúszó', '8470'),
      ('Egyéb', '4696')
  ) as v(name, google_taxonomy_id)
  where c.tenant_id = p_tenant_id
    and c.deleted_at is null
    and c.parent_id is null
    and lower(c.name) = lower(v.name)
    and (c.google_taxonomy_id is null or btrim(c.google_taxonomy_id) = '');

  insert into public.tenant_webshop_settings (tenant_id)
  values (p_tenant_id)
  on conflict (tenant_id) do nothing;
end;
$$;

revoke all on function public.seed_webshop_defaults_for_tenant(uuid) from public;
grant execute on function public.seed_webshop_defaults_for_tenant(uuid) to service_role;

-- Backfill settings minden webshop-kategóriás tenantnak
insert into public.tenant_webshop_settings (tenant_id)
select distinct c.tenant_id
from public.web_categories c
where c.deleted_at is null
on conflict (tenant_id) do nothing;

-- Entitled tenantek is (ha van entitlement, de még nincs kategória)
insert into public.tenant_webshop_settings (tenant_id)
select distinct e.tenant_id
from public.tenant_entitlements e
where e.feature_key in (
  'webshop',
  '/webshop',
  '/webshop/katalogus',
  '/webshop/kategoriak',
  '/webshop/tulajdonsagok'
)
on conflict (tenant_id) do nothing;
