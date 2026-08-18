-- =============================================================================
-- b2b-portal / 012_shop_customer_activities.sql
-- MANUÁLISAN futtasd — előtte: 009 + 011
-- Manager követés: „Megcsináltam” + következő dátum
-- =============================================================================

create table if not exists public.shop_customer_activities (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null
    references public.shops (id) on delete cascade,
  shop_customer_id uuid
    references public.shop_customers (id) on delete set null,
  sr_customer_inner_id integer not null,
  kind text not null
    check (kind in ('done_call', 'done_email', 'done_other', 'note')),
  note text,
  next_follow_up_at date,
  actor_user_id uuid
    references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_sca_shop_customer
  on public.shop_customer_activities (shop_id, sr_customer_inner_id, created_at desc);
create index if not exists idx_sca_shop_followup
  on public.shop_customer_activities (shop_id, next_follow_up_at)
  where next_follow_up_at is not null;

alter table public.shop_customers
  add column if not exists next_follow_up_at date,
  add column if not exists last_activity_at timestamptz,
  add column if not exists last_activity_kind text;

create index if not exists idx_shop_customers_followup
  on public.shop_customers (shop_id, next_follow_up_at)
  where next_follow_up_at is not null;

grant select, insert, update, delete on public.shop_customer_activities
  to b2b_app, b2b_admin;

alter table public.shop_customer_activities enable row level security;
alter table public.shop_customer_activities force row level security;

drop policy if exists sca_tenant on public.shop_customer_activities;
create policy sca_tenant on public.shop_customer_activities
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
values ('012_shop_customer_activities.sql')
on conflict (filename) do nothing;
