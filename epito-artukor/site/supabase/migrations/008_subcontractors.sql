-- =============================================================================
-- Építő Ártükör — Alvállalkozók (manuálisan futtasd a Supabase SQL Editorban)
-- =============================================================================
-- Előfeltétel: 001–007 migrációk lefutottak
-- code = szerkeszthető partnerkód (linkekhez), org-on belül egyedi
-- =============================================================================

create table if not exists public.subcontractors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  code text not null,
  legal_name text not null,
  display_name text not null,
  tax_number text,
  company_reg_number text,
  tier text not null default 'new'
    check (tier in ('preferred', 'standard', 'reserve', 'new')),
  status text not null default 'prospect'
    check (status in ('active', 'inactive', 'blocked', 'prospect')),
  email text,
  phone text,
  website text,
  address text,
  internal_notes text not null default '',
  rating smallint check (rating is null or (rating >= 1 and rating <= 5)),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists subcontractors_org_code_unique_active
  on public.subcontractors (organization_id, lower(code))
  where deleted_at is null;

create unique index if not exists subcontractors_org_tax_unique_active
  on public.subcontractors (organization_id, tax_number)
  where deleted_at is null and tax_number is not null and trim(tax_number) <> '';

create index if not exists idx_subcontractors_organization
  on public.subcontractors (organization_id)
  where deleted_at is null;

create index if not exists idx_subcontractors_status
  on public.subcontractors (organization_id, status)
  where deleted_at is null;

drop trigger if exists subcontractors_updated_at on public.subcontractors;
create trigger subcontractors_updated_at
  before update on public.subcontractors
  for each row
  execute function public.set_updated_at();

-- M:N szakágak
create table if not exists public.subcontractor_trades (
  subcontractor_id uuid not null references public.subcontractors (id) on delete cascade,
  trade_id uuid not null references public.trades (id) on delete cascade,
  primary key (subcontractor_id, trade_id)
);

create index if not exists idx_subcontractor_trades_trade
  on public.subcontractor_trades (trade_id);

-- Kapcsolattartók
create table if not exists public.subcontractor_contacts (
  id uuid primary key default gen_random_uuid(),
  subcontractor_id uuid not null references public.subcontractors (id) on delete cascade,
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

create index if not exists idx_subcontractor_contacts_sub
  on public.subcontractor_contacts (subcontractor_id)
  where deleted_at is null;

drop trigger if exists subcontractor_contacts_updated_at on public.subcontractor_contacts;
create trigger subcontractor_contacts_updated_at
  before update on public.subcontractor_contacts
  for each row
  execute function public.set_updated_at();

-- Referenciák (szöveges — képek nélkül)
create table if not exists public.subcontractor_references (
  id uuid primary key default gen_random_uuid(),
  subcontractor_id uuid not null references public.subcontractors (id) on delete cascade,
  title text not null,
  project_name text,
  trade_id uuid references public.trades (id) on delete set null,
  year int check (year is null or (year >= 1900 and year <= 2100)),
  description text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_subcontractor_references_sub
  on public.subcontractor_references (subcontractor_id)
  where deleted_at is null;

drop trigger if exists subcontractor_references_updated_at on public.subcontractor_references;
create trigger subcontractor_references_updated_at
  before update on public.subcontractor_references
  for each row
  execute function public.set_updated_at();

-- RLS
alter table public.subcontractors enable row level security;
alter table public.subcontractor_trades enable row level security;
alter table public.subcontractor_contacts enable row level security;
alter table public.subcontractor_references enable row level security;

drop policy if exists "subcontractors_select_member" on public.subcontractors;
create policy "subcontractors_select_member"
  on public.subcontractors for select
  using (
    deleted_at is null
    and exists (
      select 1 from public.organization_members om
      where om.organization_id = subcontractors.organization_id
        and om.user_id = auth.uid()
    )
  );

drop policy if exists "subcontractors_insert_member" on public.subcontractors;
create policy "subcontractors_insert_member"
  on public.subcontractors for insert
  with check (
    exists (
      select 1 from public.organization_members om
      where om.organization_id = subcontractors.organization_id
        and om.user_id = auth.uid()
    )
  );

drop policy if exists "subcontractors_update_member" on public.subcontractors;
create policy "subcontractors_update_member"
  on public.subcontractors for update
  using (
    exists (
      select 1 from public.organization_members om
      where om.organization_id = subcontractors.organization_id
        and om.user_id = auth.uid()
    )
  );

drop policy if exists "subcontractors_delete_member" on public.subcontractors;
create policy "subcontractors_delete_member"
  on public.subcontractors for delete
  using (
    exists (
      select 1 from public.organization_members om
      where om.organization_id = subcontractors.organization_id
        and om.user_id = auth.uid()
    )
  );

drop policy if exists "subcontractor_trades_all_member" on public.subcontractor_trades;
create policy "subcontractor_trades_all_member"
  on public.subcontractor_trades for all
  using (
    exists (
      select 1
      from public.subcontractors s
      join public.organization_members om on om.organization_id = s.organization_id
      where s.id = subcontractor_trades.subcontractor_id
        and om.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.subcontractors s
      join public.organization_members om on om.organization_id = s.organization_id
      where s.id = subcontractor_trades.subcontractor_id
        and om.user_id = auth.uid()
    )
  );

drop policy if exists "subcontractor_contacts_all_member" on public.subcontractor_contacts;
create policy "subcontractor_contacts_all_member"
  on public.subcontractor_contacts for all
  using (
    exists (
      select 1
      from public.subcontractors s
      join public.organization_members om on om.organization_id = s.organization_id
      where s.id = subcontractor_contacts.subcontractor_id
        and om.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.subcontractors s
      join public.organization_members om on om.organization_id = s.organization_id
      where s.id = subcontractor_contacts.subcontractor_id
        and om.user_id = auth.uid()
    )
  );

drop policy if exists "subcontractor_references_all_member" on public.subcontractor_references;
create policy "subcontractor_references_all_member"
  on public.subcontractor_references for all
  using (
    exists (
      select 1
      from public.subcontractors s
      join public.organization_members om on om.organization_id = s.organization_id
      where s.id = subcontractor_references.subcontractor_id
        and om.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.subcontractors s
      join public.organization_members om on om.organization_id = s.organization_id
      where s.id = subcontractor_references.subcontractor_id
        and om.user_id = auth.uid()
    )
  );

-- Seed: demo cég alap partnerek (idempotens, code alapján)
insert into public.subcontractors (
  organization_id, code, legal_name, display_name, tax_number, tier, status,
  email, phone, website, address, internal_notes, rating, tags
)
select
  o.id,
  v.code,
  v.legal_name,
  v.display_name,
  v.tax_number,
  v.tier,
  v.status,
  v.email,
  v.phone,
  v.website,
  v.address,
  v.internal_notes,
  v.rating,
  v.tags
from public.organizations o
cross join (
  values
    (
      'klima-pro', 'Klima-Pro Kft.', 'Klima-Pro', '12345678-2-13',
      'preferred', 'active', 'ajanlat@klimapro.hu', '+36 30 111 2233',
      'https://klimapro.hu', '1117 Budapest, Irinyi J. u. 4.',
      'Megbízható showroom projekteken.', 5::smallint,
      array['klíma', 'showroom', 'Budapest']::text[]
    ),
    (
      'hutes-max', 'Hűtés-Max Zrt.', 'Hűtés-Max', '23456789-2-14',
      'standard', 'active', 'info@hutesmax.hu', '+36 70 222 3344',
      'https://hutesmax.hu', '2040 Budaörs, Iparos u. 12.',
      '', 4::smallint, array['klíma', 'ipari']::text[]
    ),
    (
      'nyilas-tech', 'Nyílás-Tech Zrt.', 'Nyílás-Tech', '34567890-2-15',
      'standard', 'active', 'ertekesites@nyilastech.hu', '+36 30 333 4455',
      'https://nyilastech.hu', '1033 Budapest, Szentendrei út 89.',
      'Jó ár-érték, néha csúszik a határidő.', 3::smallint,
      array['ablak', 'ajtó', 'showroom']::text[]
    )
) as v(
  code, legal_name, display_name, tax_number, tier, status,
  email, phone, website, address, internal_notes, rating, tags
)
where o.slug = 'demo'
  and not exists (
    select 1 from public.subcontractors s
    where s.organization_id = o.id
      and lower(s.code) = lower(v.code)
      and s.deleted_at is null
  );

-- Szakág kapcsolatok seed
insert into public.subcontractor_trades (subcontractor_id, trade_id)
select s.id, t.id
from public.subcontractors s
join public.organizations o on o.id = s.organization_id
join public.trades t on t.organization_id = o.id and t.deleted_at is null
where o.slug = 'demo'
  and s.deleted_at is null
  and (
    (s.code = 'klima-pro' and t.code = 'gepeszet')
    or (s.code = 'hutes-max' and t.code = 'gepeszet')
    or (s.code = 'nyilas-tech' and t.code = 'nyilaszaró')
  )
  and not exists (
    select 1 from public.subcontractor_trades st
    where st.subcontractor_id = s.id and st.trade_id = t.id
  );
