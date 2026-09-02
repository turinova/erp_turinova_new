-- =============================================================================
-- b2b-portal / 039_shop_customers_mirror.sql
-- MANUÁLISAN futtasd — előtte: 009, 026
-- Vékony vevő-tükör bővítés (nem full CRM): company, approved, SR created_at
-- =============================================================================

alter table public.shop_customers
  add column if not exists company_snapshot text;

alter table public.shop_customers
  add column if not exists approved boolean;

alter table public.shop_customers
  add column if not exists date_created_sr timestamptz;

comment on column public.shop_customers.company_snapshot is
  'Cégnév snapshot (cím / profil) — ProGate fejléc, nem élő SoT.';
comment on column public.shop_customers.approved is
  'Shoprenter approved flag tükör.';
comment on column public.shop_customers.date_created_sr is
  'Shoprenter customer dateCreated tükör.';

create table if not exists public.shop_customer_sync_state (
  shop_id uuid primary key
    references public.shops (id) on delete cascade,
  cursor_page integer not null default 0,
  last_run_at timestamptz,
  last_error text,
  row_count integer not null default 0,
  status text not null default 'idle'
    check (status in ('idle', 'running', 'error', 'done'))
);

grant select, insert, update, delete on
  public.shop_customer_sync_state
to b2b_app, b2b_admin;

alter table public.shop_customer_sync_state enable row level security;
alter table public.shop_customer_sync_state force row level security;

drop policy if exists shop_customer_sync_state_tenant
  on public.shop_customer_sync_state;
create policy shop_customer_sync_state_tenant
  on public.shop_customer_sync_state
  for all
  using (
    public.is_b2b_admin()
    or exists (
      select 1 from public.shops s
      where s.id = shop_id and s.organization_id = public.current_org_id()
    )
  )
  with check (
    public.is_b2b_admin()
    or exists (
      select 1 from public.shops s
      where s.id = shop_id and s.organization_id = public.current_org_id()
    )
  );

insert into public.schema_migrations (filename)
values ('039_shop_customers_mirror.sql')
on conflict (filename) do nothing;
