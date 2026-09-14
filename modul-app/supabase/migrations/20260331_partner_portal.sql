-- modul-app: Partner portal foundation (Fázis 1)
-- Docs: docs/20-partner-portal.md
-- Futtasd: entitlements (20260327+) + customers + quotes után.

-- ---------------------------------------------------------------------------
-- Entitlement helper (nem függ partner_profiles-tól)
-- ---------------------------------------------------------------------------
create or replace function public.tenant_accepts_partner_orders(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenants t
    join public.tenant_entitlements e
      on e.tenant_id = t.id
     and e.feature_key = 'partner_orders'
    where t.id = p_tenant_id
      and t.status = 'active'
  );
$$;

revoke all on function public.tenant_accepts_partner_orders(uuid) from public;
grant execute on function public.tenant_accepts_partner_orders(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- partner_profiles
-- ---------------------------------------------------------------------------
create table if not exists public.partner_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null,
  mobile text,
  billing_name text,
  billing_country text not null default 'Magyarország',
  billing_city text,
  billing_postal_code text,
  billing_street text,
  billing_house_number text,
  billing_tax_number text,
  billing_company_reg_number text,
  selected_tenant_id uuid references public.tenants (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partner_profiles_selected_tenant_idx
  on public.partner_profiles (selected_tenant_id)
  where selected_tenant_id is not null;

create index if not exists partner_profiles_email_lower_idx
  on public.partner_profiles (lower(email));

comment on table public.partner_profiles is
  'Online asztalos / partner — nem tenant membership, nem seat.';

alter table public.partner_profiles enable row level security;

drop policy if exists partner_profiles_select_own on public.partner_profiles;
create policy partner_profiles_select_own
  on public.partner_profiles
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_platform_admin());

drop policy if exists partner_profiles_insert_own on public.partner_profiles;
create policy partner_profiles_insert_own
  on public.partner_profiles
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists partner_profiles_update_own on public.partner_profiles;
create policy partner_profiles_update_own
  on public.partner_profiles
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- V1: staff membership és partner profil kizárják egymást
create or replace function public.partner_profiles_reject_staff()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.tenant_memberships m
    where m.user_id = new.user_id
  ) then
    raise exception 'Staff felhasználó nem lehet partner (V1).'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists partner_profiles_reject_staff_trg on public.partner_profiles;
create trigger partner_profiles_reject_staff_trg
  before insert or update of user_id on public.partner_profiles
  for each row
  execute function public.partner_profiles_reject_staff();

create or replace function public.tenant_memberships_reject_partner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.partner_profiles p
    where p.user_id = new.user_id
  ) then
    raise exception 'Partner felhasználó nem lehet staff tag (V1).'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists tenant_memberships_reject_partner_trg on public.tenant_memberships;
create trigger tenant_memberships_reject_partner_trg
  before insert or update of user_id on public.tenant_memberships
  for each row
  execute function public.tenant_memberships_reject_partner();

-- ---------------------------------------------------------------------------
-- Partner helpers (tábla után)
-- ---------------------------------------------------------------------------
create or replace function public.is_partner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.partner_profiles p
    where p.user_id = auth.uid()
  );
$$;

revoke all on function public.is_partner() from public;
grant execute on function public.is_partner() to authenticated;

create or replace function public.partner_selected_tenant_is(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.partner_profiles p
    where p.user_id = auth.uid()
      and p.selected_tenant_id = p_tenant_id
  );
$$;

revoke all on function public.partner_selected_tenant_is(uuid) from public;
grant execute on function public.partner_selected_tenant_is(uuid) to authenticated;

create or replace function public.partner_can_read_tenant_catalog(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_partner()
    and public.partner_selected_tenant_is(p_tenant_id)
    and public.tenant_accepts_partner_orders(p_tenant_id);
$$;

revoke all on function public.partner_can_read_tenant_catalog(uuid) from public;
grant execute on function public.partner_can_read_tenant_catalog(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- customers: partner link + unique indexek
-- ---------------------------------------------------------------------------
alter table public.customers
  add column if not exists partner_profile_id uuid
    references public.partner_profiles (user_id) on delete set null;

drop index if exists public.customers_tenant_name_alive_uidx;

create unique index if not exists customers_tenant_name_staff_alive_uidx
  on public.customers (tenant_id, lower(name))
  where deleted_at is null and partner_profile_id is null;

create unique index if not exists customers_tenant_partner_alive_uidx
  on public.customers (tenant_id, partner_profile_id)
  where deleted_at is null and partner_profile_id is not null;

create index if not exists customers_partner_profile_idx
  on public.customers (partner_profile_id)
  where partner_profile_id is not null and deleted_at is null;

comment on column public.customers.partner_profile_id is
  'Online partner link — egy partner max egy élő ügyfél / tenant.';

drop policy if exists customers_select_own_partner on public.customers;
create policy customers_select_own_partner
  on public.customers
  for select
  to authenticated
  using (
    partner_profile_id = auth.uid()
    and public.is_partner()
  );

-- ---------------------------------------------------------------------------
-- quotes: partner + submitted marker
-- ---------------------------------------------------------------------------
alter table public.quotes
  add column if not exists partner_profile_id uuid
    references public.partner_profiles (user_id) on delete set null;

alter table public.quotes
  add column if not exists portal_submitted_at timestamptz;

create index if not exists quotes_partner_profile_alive_idx
  on public.quotes (partner_profile_id)
  where deleted_at is null and partner_profile_id is not null;

create index if not exists quotes_portal_submitted_alive_idx
  on public.quotes (tenant_id, portal_submitted_at desc)
  where deleted_at is null and source = 'portal' and portal_submitted_at is not null;

comment on column public.quotes.partner_profile_id is
  'Portal / partner szerző; staff opti quote-nál null.';
comment on column public.quotes.portal_submitted_at is
  'Partner beküldés ideje; null = csak mentett draft. Status maradhat draft.';

drop policy if exists quotes_select_own_partner on public.quotes;
create policy quotes_select_own_partner
  on public.quotes
  for select
  to authenticated
  using (
    partner_profile_id = auth.uid()
    and public.is_partner()
  );

drop policy if exists quotes_insert_partner_portal on public.quotes;
create policy quotes_insert_partner_portal
  on public.quotes
  for insert
  to authenticated
  with check (
    public.is_partner()
    and partner_profile_id = auth.uid()
    and created_by = auth.uid()
    and source = 'portal'
    and status = 'draft'
    and portal_submitted_at is null
    and public.tenant_accepts_partner_orders(tenant_id)
    and public.partner_selected_tenant_is(tenant_id)
  );

drop policy if exists quotes_update_partner_portal_draft on public.quotes;
create policy quotes_update_partner_portal_draft
  on public.quotes
  for update
  to authenticated
  using (
    public.is_partner()
    and partner_profile_id = auth.uid()
    and source = 'portal'
    and status = 'draft'
    and portal_submitted_at is null
    and deleted_at is null
  )
  with check (
    public.is_partner()
    and partner_profile_id = auth.uid()
    and source = 'portal'
    and status = 'draft'
    and deleted_at is null
  );

drop policy if exists quotes_delete_partner_portal_draft on public.quotes;
create policy quotes_delete_partner_portal_draft
  on public.quotes
  for delete
  to authenticated
  using (
    public.is_partner()
    and partner_profile_id = auth.uid()
    and source = 'portal'
    and status = 'draft'
    and portal_submitted_at is null
    and deleted_at is null
  );

-- Child tables: partner read/write via parent quote ownership
drop policy if exists quote_panels_select_partner on public.quote_panels;
create policy quote_panels_select_partner
  on public.quote_panels
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.quotes q
      where q.id = quote_id
        and q.partner_profile_id = auth.uid()
        and q.deleted_at is null
    )
  );

drop policy if exists quote_panels_insert_partner on public.quote_panels;
create policy quote_panels_insert_partner
  on public.quote_panels
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.quotes q
      where q.id = quote_id
        and q.partner_profile_id = auth.uid()
        and q.source = 'portal'
        and q.status = 'draft'
        and q.portal_submitted_at is null
        and q.deleted_at is null
    )
  );

drop policy if exists quote_panels_update_partner on public.quote_panels;
create policy quote_panels_update_partner
  on public.quote_panels
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.quotes q
      where q.id = quote_id
        and q.partner_profile_id = auth.uid()
        and q.source = 'portal'
        and q.status = 'draft'
        and q.portal_submitted_at is null
        and q.deleted_at is null
    )
  )
  with check (
    exists (
      select 1
      from public.quotes q
      where q.id = quote_id
        and q.partner_profile_id = auth.uid()
        and q.source = 'portal'
        and q.status = 'draft'
        and q.portal_submitted_at is null
        and q.deleted_at is null
    )
  );

drop policy if exists quote_panels_delete_partner on public.quote_panels;
create policy quote_panels_delete_partner
  on public.quote_panels
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.quotes q
      where q.id = quote_id
        and q.partner_profile_id = auth.uid()
        and q.source = 'portal'
        and q.status = 'draft'
        and q.portal_submitted_at is null
        and q.deleted_at is null
    )
  );

drop policy if exists quote_material_lines_select_partner on public.quote_material_lines;
create policy quote_material_lines_select_partner
  on public.quote_material_lines
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.quotes q
      where q.id = quote_id
        and q.partner_profile_id = auth.uid()
        and q.deleted_at is null
    )
  );

drop policy if exists quote_material_lines_insert_partner on public.quote_material_lines;
create policy quote_material_lines_insert_partner
  on public.quote_material_lines
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.quotes q
      where q.id = quote_id
        and q.partner_profile_id = auth.uid()
        and q.source = 'portal'
        and q.status = 'draft'
        and q.portal_submitted_at is null
        and q.deleted_at is null
    )
  );

drop policy if exists quote_material_lines_update_partner on public.quote_material_lines;
create policy quote_material_lines_update_partner
  on public.quote_material_lines
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.quotes q
      where q.id = quote_id
        and q.partner_profile_id = auth.uid()
        and q.source = 'portal'
        and q.status = 'draft'
        and q.portal_submitted_at is null
        and q.deleted_at is null
    )
  )
  with check (
    exists (
      select 1
      from public.quotes q
      where q.id = quote_id
        and q.partner_profile_id = auth.uid()
        and q.source = 'portal'
        and q.status = 'draft'
        and q.portal_submitted_at is null
        and q.deleted_at is null
    )
  );

drop policy if exists quote_material_lines_delete_partner on public.quote_material_lines;
create policy quote_material_lines_delete_partner
  on public.quote_material_lines
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.quotes q
      where q.id = quote_id
        and q.partner_profile_id = auth.uid()
        and q.source = 'portal'
        and q.status = 'draft'
        and q.portal_submitted_at is null
        and q.deleted_at is null
    )
  );

drop policy if exists quote_edge_lines_select_partner on public.quote_edge_lines;
create policy quote_edge_lines_select_partner
  on public.quote_edge_lines
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.quote_material_lines ml
      join public.quotes q on q.id = ml.quote_id
      where ml.id = quote_material_line_id
        and q.partner_profile_id = auth.uid()
        and q.deleted_at is null
    )
  );

drop policy if exists quote_edge_lines_insert_partner on public.quote_edge_lines;
create policy quote_edge_lines_insert_partner
  on public.quote_edge_lines
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.quote_material_lines ml
      join public.quotes q on q.id = ml.quote_id
      where ml.id = quote_material_line_id
        and q.partner_profile_id = auth.uid()
        and q.source = 'portal'
        and q.status = 'draft'
        and q.portal_submitted_at is null
        and q.deleted_at is null
    )
  );

drop policy if exists quote_edge_lines_update_partner on public.quote_edge_lines;
create policy quote_edge_lines_update_partner
  on public.quote_edge_lines
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.quote_material_lines ml
      join public.quotes q on q.id = ml.quote_id
      where ml.id = quote_material_line_id
        and q.partner_profile_id = auth.uid()
        and q.source = 'portal'
        and q.status = 'draft'
        and q.portal_submitted_at is null
        and q.deleted_at is null
    )
  )
  with check (
    exists (
      select 1
      from public.quote_material_lines ml
      join public.quotes q on q.id = ml.quote_id
      where ml.id = quote_material_line_id
        and q.partner_profile_id = auth.uid()
        and q.source = 'portal'
        and q.status = 'draft'
        and q.portal_submitted_at is null
        and q.deleted_at is null
    )
  );

drop policy if exists quote_edge_lines_delete_partner on public.quote_edge_lines;
create policy quote_edge_lines_delete_partner
  on public.quote_edge_lines
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.quote_material_lines ml
      join public.quotes q on q.id = ml.quote_id
      where ml.id = quote_material_line_id
        and q.partner_profile_id = auth.uid()
        and q.source = 'portal'
        and q.status = 'draft'
        and q.portal_submitted_at is null
        and q.deleted_at is null
    )
  );

-- ---------------------------------------------------------------------------
-- Catalog read for selected tenant (Kereső / Opti előkészítés)
-- ---------------------------------------------------------------------------
drop policy if exists sheet_materials_select_partner on public.sheet_materials;
create policy sheet_materials_select_partner
  on public.sheet_materials
  for select
  to authenticated
  using (
    deleted_at is null
    and public.partner_can_read_tenant_catalog(tenant_id)
  );

drop policy if exists edge_materials_select_partner on public.edge_materials;
create policy edge_materials_select_partner
  on public.edge_materials
  for select
  to authenticated
  using (
    deleted_at is null
    and public.partner_can_read_tenant_catalog(tenant_id)
  );

drop policy if exists cutting_fees_select_partner on public.cutting_fees;
create policy cutting_fees_select_partner
  on public.cutting_fees
  for select
  to authenticated
  using (
    deleted_at is null
    and public.partner_can_read_tenant_catalog(tenant_id)
  );

drop policy if exists manufacturers_select_partner on public.manufacturers;
create policy manufacturers_select_partner
  on public.manufacturers
  for select
  to authenticated
  using (
    deleted_at is null
    and public.partner_can_read_tenant_catalog(tenant_id)
  );

drop policy if exists tax_rates_select_partner on public.tax_rates;
create policy tax_rates_select_partner
  on public.tax_rates
  for select
  to authenticated
  using (
    deleted_at is null
    and public.partner_can_read_tenant_catalog(tenant_id)
  );

-- Nyilvános partner céglista (add-on + active)
drop policy if exists tenants_select_partner_directory on public.tenants;
create policy tenants_select_partner_directory
  on public.tenants
  for select
  to authenticated
  using (
    public.is_partner()
    and status = 'active'
    and public.tenant_accepts_partner_orders(id)
  );

-- Tenant company contact card a partner kezdőlaphoz
drop policy if exists tenant_companies_select_partner on public.tenant_companies;
create policy tenant_companies_select_partner
  on public.tenant_companies
  for select
  to authenticated
  using (public.partner_can_read_tenant_catalog(tenant_id));

-- ---------------------------------------------------------------------------
-- ensure_partner_customer — első draft mentés (modell A)
-- ---------------------------------------------------------------------------
create or replace function public.ensure_partner_customer(p_tenant_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.partner_profiles%rowtype;
  v_customer_id uuid;
  v_email text;
  v_name text;
begin
  if v_uid is null then
    raise exception 'Nincs bejelentkezés.';
  end if;

  select * into v_profile
  from public.partner_profiles
  where user_id = v_uid;

  if not found then
    raise exception 'Nincs partner profil.';
  end if;

  if not public.tenant_accepts_partner_orders(p_tenant_id) then
    raise exception 'Ez a cég nem fogad online partner rendelést.';
  end if;

  if v_profile.selected_tenant_id is distinct from p_tenant_id then
    raise exception 'A kiválasztott cég nem egyezik.';
  end if;

  v_email := lower(trim(v_profile.email));
  v_name := nullif(trim(v_profile.name), '');
  if v_name is null then
    v_name := 'Online ügyfél';
  end if;

  -- 1) Már linked
  select c.id into v_customer_id
  from public.customers c
  where c.tenant_id = p_tenant_id
    and c.partner_profile_id = v_uid
    and c.deleted_at is null
  limit 1;

  if v_customer_id is not null then
    update public.customers
    set
      name = v_name,
      email = v_email,
      mobile = coalesce(v_profile.mobile, mobile),
      billing_name = coalesce(v_profile.billing_name, billing_name),
      billing_country = coalesce(v_profile.billing_country, billing_country),
      billing_city = coalesce(v_profile.billing_city, billing_city),
      billing_postal_code = coalesce(v_profile.billing_postal_code, billing_postal_code),
      billing_street = coalesce(v_profile.billing_street, billing_street),
      billing_house_number = coalesce(v_profile.billing_house_number, billing_house_number),
      billing_tax_number = coalesce(v_profile.billing_tax_number, billing_tax_number),
      billing_company_reg_number = coalesce(
        v_profile.billing_company_reg_number,
        billing_company_reg_number
      ),
      updated_at = now()
    where id = v_customer_id;
    return v_customer_id;
  end if;

  -- 2) Soft-deleted linked
  select c.id into v_customer_id
  from public.customers c
  where c.tenant_id = p_tenant_id
    and c.partner_profile_id = v_uid
    and c.deleted_at is not null
  order by c.deleted_at desc
  limit 1;

  if v_customer_id is not null then
    update public.customers
    set
      deleted_at = null,
      name = v_name,
      email = v_email,
      mobile = coalesce(v_profile.mobile, ''),
      billing_name = v_profile.billing_name,
      billing_country = coalesce(v_profile.billing_country, 'Magyarország'),
      billing_city = v_profile.billing_city,
      billing_postal_code = v_profile.billing_postal_code,
      billing_street = v_profile.billing_street,
      billing_house_number = v_profile.billing_house_number,
      billing_tax_number = v_profile.billing_tax_number,
      billing_company_reg_number = v_profile.billing_company_reg_number,
      updated_at = now()
    where id = v_customer_id;
    return v_customer_id;
  end if;

  -- 3) Email merge (élő, még nem partner-linked)
  if v_email <> '' then
    select c.id into v_customer_id
    from public.customers c
    where c.tenant_id = p_tenant_id
      and c.deleted_at is null
      and c.partner_profile_id is null
      and c.email is not null
      and lower(trim(c.email)) = v_email
    order by c.created_at asc
    limit 1;

    if v_customer_id is not null then
      update public.customers
      set
        partner_profile_id = v_uid,
        mobile = coalesce(nullif(trim(mobile), ''), v_profile.mobile, mobile),
        billing_name = coalesce(billing_name, v_profile.billing_name),
        billing_country = coalesce(billing_country, v_profile.billing_country, 'Magyarország'),
        billing_city = coalesce(billing_city, v_profile.billing_city),
        billing_postal_code = coalesce(billing_postal_code, v_profile.billing_postal_code),
        billing_street = coalesce(billing_street, v_profile.billing_street),
        billing_house_number = coalesce(billing_house_number, v_profile.billing_house_number),
        billing_tax_number = coalesce(billing_tax_number, v_profile.billing_tax_number),
        billing_company_reg_number = coalesce(
          billing_company_reg_number,
          v_profile.billing_company_reg_number
        ),
        updated_at = now()
      where id = v_customer_id;
      return v_customer_id;
    end if;

    -- Soft-deleted by email
    select c.id into v_customer_id
    from public.customers c
    where c.tenant_id = p_tenant_id
      and c.deleted_at is not null
      and c.email is not null
      and lower(trim(c.email)) = v_email
    order by c.deleted_at desc
    limit 1;

    if v_customer_id is not null then
      update public.customers
      set
        deleted_at = null,
        partner_profile_id = v_uid,
        name = v_name,
        email = v_email,
        mobile = coalesce(v_profile.mobile, ''),
        billing_name = v_profile.billing_name,
        billing_country = coalesce(v_profile.billing_country, 'Magyarország'),
        billing_city = v_profile.billing_city,
        billing_postal_code = v_profile.billing_postal_code,
        billing_street = v_profile.billing_street,
        billing_house_number = v_profile.billing_house_number,
        billing_tax_number = v_profile.billing_tax_number,
        billing_company_reg_number = v_profile.billing_company_reg_number,
        updated_at = now()
      where id = v_customer_id;
      return v_customer_id;
    end if;
  end if;

  -- 4) Insert
  insert into public.customers (
    tenant_id,
    partner_profile_id,
    name,
    email,
    mobile,
    billing_name,
    billing_country,
    billing_city,
    billing_postal_code,
    billing_street,
    billing_house_number,
    billing_tax_number,
    billing_company_reg_number
  )
  values (
    p_tenant_id,
    v_uid,
    v_name,
    nullif(v_email, ''),
    v_profile.mobile,
    v_profile.billing_name,
    coalesce(v_profile.billing_country, 'Magyarország'),
    v_profile.billing_city,
    v_profile.billing_postal_code,
    v_profile.billing_street,
    v_profile.billing_house_number,
    v_profile.billing_tax_number,
    v_profile.billing_company_reg_number
  )
  returning id into v_customer_id;

  return v_customer_id;
exception
  when unique_violation then
    -- Race: másik request már létrehozta / linkelte
    select c.id into v_customer_id
    from public.customers c
    where c.tenant_id = p_tenant_id
      and c.partner_profile_id = v_uid
      and c.deleted_at is null
    limit 1;
    if v_customer_id is null then
      raise;
    end if;
    return v_customer_id;
end;
$$;

revoke all on function public.ensure_partner_customer(uuid) from public;
grant execute on function public.ensure_partner_customer(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Feature + add-on katalógus (NEM az Alap plan része)
-- ---------------------------------------------------------------------------
insert into public.product_features (key, label, category, page_key, sort_order, active)
values (
  'partner_orders',
  'Online partner rendelés',
  'Add-on',
  null,
  500,
  true
)
on conflict (key) do update
set
  label = excluded.label,
  category = excluded.category,
  page_key = excluded.page_key,
  sort_order = excluded.sort_order,
  active = true;

insert into public.product_addons (key, name, description, active)
values (
  'partner_orders',
  'Online partner rendelés',
  'Külső asztalosok az optinova.hu-n a cég anyagaival Optizhatnak és draft ajánlatot küldhetnek be.',
  true
)
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description,
  active = true,
  updated_at = now();

insert into public.product_addon_features (addon_id, feature_key)
select a.id, 'partner_orders'
from public.product_addons a
where a.key = 'partner_orders'
on conflict do nothing;
