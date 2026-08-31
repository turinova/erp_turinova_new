-- =============================================================================
-- b2b-portal / 032_widget_customer_lists.sql
-- MANUÁLISAN futtasd — előtte: 004 (widget_settings), 011/017 RLS minták, 031
-- 1) Partner saját widget listák (Listáim)
-- 2) Backfill: active plus/pro → hideTurinovaMark = true
-- =============================================================================

create table if not exists public.widget_customer_lists (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null
    references public.shops (id) on delete cascade,
  customer_inner_id integer not null,
  name text not null,
  lines jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint widget_customer_lists_inner_positive
    check (customer_inner_id > 0),
  constraint widget_customer_lists_name_len
    check (char_length(trim(name)) between 1 and 80),
  constraint widget_customer_lists_lines_is_array
    check (jsonb_typeof(lines) = 'array')
);

create index if not exists idx_widget_customer_lists_shop_customer
  on public.widget_customer_lists (shop_id, customer_inner_id, updated_at desc);

create unique index if not exists idx_widget_customer_lists_unique_name
  on public.widget_customer_lists (
    shop_id,
    customer_inner_id,
    lower(trim(name))
  );

drop trigger if exists trg_widget_customer_lists_updated_at
  on public.widget_customer_lists;
create trigger trg_widget_customer_lists_updated_at
  before update on public.widget_customer_lists
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on
  public.widget_customer_lists
to b2b_app, b2b_admin;

alter table public.widget_customer_lists enable row level security;
alter table public.widget_customer_lists force row level security;

drop policy if exists widget_customer_lists_tenant on public.widget_customer_lists;
create policy widget_customer_lists_tenant on public.widget_customer_lists
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

-- White-label: paid plus/pro → hide Turinova mark on live widget
update public.widget_settings w
set
  settings = jsonb_set(
    jsonb_set(
      coalesce(w.settings, '{}'::jsonb),
      '{features}',
      coalesce(w.settings->'features', '{}'::jsonb),
      true
    ),
    '{features,hideTurinovaMark}',
    'true'::jsonb,
    true
  ),
  updated_at = now()
from public.shops s
join public.organizations o on o.id = s.organization_id
where w.shop_id = s.id
  and s.purged_at is null
  and o.status = 'active'
  and o.plan in ('plus', 'pro', 'grow', 'scale');

insert into public.schema_migrations (filename)
values ('032_widget_customer_lists.sql')
on conflict (filename) do nothing;
