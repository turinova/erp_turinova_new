-- =============================================================================
-- Építő Ártükör — Ügyfelek (manuálisan futtasd a Supabase SQL Editorban)
-- =============================================================================
-- Előfeltétel: 001_auth_foundation.sql már lefutott
-- =============================================================================

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  code text not null,
  client_type text not null default 'individual'
    check (client_type in ('company', 'individual')),
  legal_name text not null,
  display_name text not null,
  tax_number text,
  company_reg_number text,
  email text,
  phone text,
  website text,
  billing_postal_code text not null default '',
  billing_city text not null default '',
  billing_street text not null default '',
  use_separate_mailing_address boolean not null default false,
  mail_postal_code text,
  mail_city text,
  mail_street text,
  default_vat_mode text
    check (default_vat_mode is null or default_vat_mode in ('standard', 'reduced', 'aam', 'reverse_charge')),
  default_payment_terms text not null default '',
  status text not null default 'active'
    check (status in ('active', 'inactive', 'prospect')),
  tags text[] not null default '{}',
  internal_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists clients_org_code_unique_active
  on public.clients (organization_id, lower(code))
  where deleted_at is null;

create unique index if not exists clients_org_tax_unique_active
  on public.clients (organization_id, tax_number)
  where deleted_at is null and tax_number is not null and trim(tax_number) <> '';

create index if not exists idx_clients_organization
  on public.clients (organization_id)
  where deleted_at is null;

create index if not exists idx_clients_status
  on public.clients (organization_id, status)
  where deleted_at is null;

drop trigger if exists clients_updated_at on public.clients;
create trigger clients_updated_at
  before update on public.clients
  for each row
  execute function public.set_updated_at();

create table if not exists public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  name text not null,
  role text,
  email text,
  phone text,
  is_primary boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_client_contacts_client
  on public.client_contacts (client_id)
  where deleted_at is null;

drop trigger if exists client_contacts_updated_at on public.client_contacts;
create trigger client_contacts_updated_at
  before update on public.client_contacts
  for each row
  execute function public.set_updated_at();

alter table public.clients enable row level security;
alter table public.client_contacts enable row level security;

drop policy if exists "clients_select_member" on public.clients;
create policy "clients_select_member"
  on public.clients for select
  using (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = clients.organization_id
        and om.user_id = auth.uid()
    )
  );

drop policy if exists "clients_insert_member" on public.clients;
create policy "clients_insert_member"
  on public.clients for insert
  with check (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = clients.organization_id
        and om.user_id = auth.uid()
    )
  );

drop policy if exists "clients_update_member" on public.clients;
create policy "clients_update_member"
  on public.clients for update
  using (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = clients.organization_id
        and om.user_id = auth.uid()
    )
  );

drop policy if exists "clients_delete_member" on public.clients;
create policy "clients_delete_member"
  on public.clients for delete
  using (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = clients.organization_id
        and om.user_id = auth.uid()
    )
  );

drop policy if exists "client_contacts_all_member" on public.client_contacts;
create policy "client_contacts_all_member"
  on public.client_contacts for all
  using (
    exists (
      select 1
      from public.clients c
      join public.organization_members om on om.organization_id = c.organization_id
      where c.id = client_contacts.client_id
        and om.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.clients c
      join public.organization_members om on om.organization_id = c.organization_id
      where c.id = client_contacts.client_id
        and om.user_id = auth.uid()
    )
  );

-- Seed: demo ügyfelek (idempotens, code alapján)
insert into public.clients (
  organization_id, code, client_type, legal_name, display_name,
  tax_number, company_reg_number, email, phone, website,
  billing_postal_code, billing_city, billing_street,
  default_payment_terms, status, tags, internal_notes
)
select
  o.id,
  v.code,
  v.client_type,
  v.legal_name,
  v.display_name,
  v.tax_number,
  v.company_reg_number,
  v.email,
  v.phone,
  v.website,
  v.billing_postal_code,
  v.billing_city,
  v.billing_street,
  v.default_payment_terms,
  v.status,
  v.tags,
  v.internal_notes
from public.organizations o
cross join (
  values
    (
      'hyundai-magyarorszag', 'company', 'Hyundai Magyarország Kft.', 'Hyundai Magyarország',
      '12345678-2-41', '01-09-876543', 'info@hyundai.hu', '+36 1 555 0100', 'https://www.hyundai.hu',
      '1139', 'Budapest', 'Váci út 178.',
      '30 napos átutalás', 'active',
      array['showroom', 'autóipar']::text[],
      'Ismétlő ügyfél — showroom projektek.'
    ),
    (
      'magan-megrendelo', 'individual', 'Kovács Anna', 'Kovács Anna',
      null::text, null::text, 'kovacs.anna@email.hu', '+36 20 333 4455', null::text,
      '1117', 'Budapest', 'Fehérvári út 12. 4/2',
      'Előleg 50%, maradék átadáskor', 'active',
      array['lakásfelújítás']::text[],
      ''
    ),
    (
      'techpark', 'company', 'TechPark Kft.', 'TechPark',
      '23456789-2-42', '01-09-112233', 'office@techpark.hu', '+36 1 444 5566', null::text,
      '1139', 'Budapest', 'Váci út 178.',
      '30 napos átutalás', 'active',
      array['iroda', 'belsőépítés']::text[],
      'Kivitelezés alatt — IRO-2026-03 projekt.'
    )
) as v(
  code, client_type, legal_name, display_name,
  tax_number, company_reg_number, email, phone, website,
  billing_postal_code, billing_city, billing_street,
  default_payment_terms, status, tags, internal_notes
)
where o.slug = 'demo'
  and not exists (
    select 1 from public.clients c
    where c.organization_id = o.id
      and lower(c.code) = lower(v.code)
      and c.deleted_at is null
  );

-- Kapcsolattartók seed
insert into public.client_contacts (client_id, name, role, email, phone, is_primary, sort_order)
select c.id, v.name, v.role, v.email, v.phone, v.is_primary, v.sort_order
from public.clients c
join public.organizations o on o.id = c.organization_id
cross join (
  values
    ('hyundai-magyarorszag', 'Szabó Gábor', 'Beszerzés', 'gabor.szabo@hyundai.hu', '+36 30 555 0101', true, 1),
    ('techpark', 'Németh Zoltán', 'Üzemeltetés', 'zoltan.nemeth@techpark.hu', '+36 30 777 8899', true, 1)
) as v(code, name, role, email, phone, is_primary, sort_order)
where o.slug = 'demo'
  and c.deleted_at is null
  and lower(c.code) = lower(v.code)
  and not exists (
    select 1 from public.client_contacts cc
    where cc.client_id = c.id and cc.deleted_at is null
  );
