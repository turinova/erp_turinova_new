-- Teya ecommerce (online checkout) credentials — partner bankkártyás fizetés.
-- Külön a POSLink / pulti tenant_pos_settings-től (más scope, más client).
-- Nincs partner SELECT policy: a secret soha ne legyen partner-látható.
-- UI: /beallitasok/partner → „Teya online kártya”

create table if not exists public.tenant_teya_online_settings (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  enabled boolean not null default false,
  teya_env text not null default 'staging'
    check (teya_env in ('staging', 'production')),
  teya_store_id text,
  teya_client_id text,
  teya_client_secret text,
  teya_webhook_public_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.tenant_teya_online_settings is
  'Teya ecommerce / Embedded Checkout credentials (partner online kártya). Nem a POS terminál.';
comment on column public.tenant_teya_online_settings.enabled is
  'Ha true és a credentialok megvannak, a partner bankkártyás fizetés használható (későbbi checkout).';
comment on column public.tenant_teya_online_settings.teya_env is
  'staging = api.teya.xyz / id.teya.xyz; production = api.teya.com / id.teya.com';
comment on column public.tenant_teya_online_settings.teya_client_secret is
  'Ecommerce client secret — soha ne küldjük a böngészőnek.';

alter table public.tenant_teya_online_settings enable row level security;

drop policy if exists tenant_teya_online_settings_select_member
  on public.tenant_teya_online_settings;
create policy tenant_teya_online_settings_select_member
  on public.tenant_teya_online_settings
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists tenant_teya_online_settings_insert_writer
  on public.tenant_teya_online_settings;
create policy tenant_teya_online_settings_insert_writer
  on public.tenant_teya_online_settings
  for insert
  to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists tenant_teya_online_settings_update_writer
  on public.tenant_teya_online_settings;
create policy tenant_teya_online_settings_update_writer
  on public.tenant_teya_online_settings
  for update
  to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));
