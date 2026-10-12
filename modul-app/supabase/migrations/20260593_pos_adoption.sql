-- POS adoption: scan telemetry, daily goal (default 60), weekly awards, stats RPC.

-- ---------------------------------------------------------------------------
-- Scan / pick source events (barcode vs typeahead vs quick)
-- ---------------------------------------------------------------------------
create table if not exists public.pos_scan_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  warehouse_id uuid references public.warehouses (id) on delete set null,
  register_id uuid,
  shift_id uuid references public.pos_shifts (id) on delete set null,
  user_id uuid,
  source text not null
    check (source in ('barcode', 'typeahead', 'quick', 'recent', 'frequent')),
  accessory_id uuid references public.accessories (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists pos_scan_events_tenant_created_idx
  on public.pos_scan_events (tenant_id, created_at desc);

create index if not exists pos_scan_events_tenant_source_idx
  on public.pos_scan_events (tenant_id, source, created_at desc);

alter table public.pos_scan_events enable row level security;

drop policy if exists pos_scan_events_select on public.pos_scan_events;
create policy pos_scan_events_select
  on public.pos_scan_events for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists pos_scan_events_insert on public.pos_scan_events;
create policy pos_scan_events_insert
  on public.pos_scan_events for insert to authenticated
  with check (public.is_tenant_member(tenant_id));

grant select, insert on public.pos_scan_events to authenticated;

-- ---------------------------------------------------------------------------
-- Tenant daily sales goal (default 60 POS eladás / nap)
-- ---------------------------------------------------------------------------
create table if not exists public.pos_adoption_goals (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  daily_sales_target int not null default 60
    check (daily_sales_target >= 1 and daily_sales_target <= 5000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

alter table public.pos_adoption_goals enable row level security;

drop policy if exists pos_adoption_goals_select on public.pos_adoption_goals;
create policy pos_adoption_goals_select
  on public.pos_adoption_goals for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists pos_adoption_goals_upsert on public.pos_adoption_goals;
create policy pos_adoption_goals_upsert
  on public.pos_adoption_goals for all to authenticated
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

grant select, insert, update on public.pos_adoption_goals to authenticated;

-- ---------------------------------------------------------------------------
-- Weekly awards (manager picks winner — gift note, not payroll)
-- ---------------------------------------------------------------------------
create table if not exists public.pos_adoption_awards (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  week_start date not null,
  user_id uuid,
  user_label text not null,
  metric_value numeric not null default 0,
  reward_note text not null default '',
  awarded_by uuid references auth.users (id) on delete set null,
  awarded_by_label text,
  created_at timestamptz not null default now(),
  unique (tenant_id, week_start)
);

create index if not exists pos_adoption_awards_tenant_week_idx
  on public.pos_adoption_awards (tenant_id, week_start desc);

alter table public.pos_adoption_awards enable row level security;

drop policy if exists pos_adoption_awards_select on public.pos_adoption_awards;
create policy pos_adoption_awards_select
  on public.pos_adoption_awards for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists pos_adoption_awards_write on public.pos_adoption_awards;
create policy pos_adoption_awards_write
  on public.pos_adoption_awards for all to authenticated
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

grant select, insert, update, delete on public.pos_adoption_awards to authenticated;

-- ---------------------------------------------------------------------------
-- Stats: POS sales today / range + by user + scan mix
-- ---------------------------------------------------------------------------
create or replace function public.pos_adoption_stats(
  p_tenant_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_warehouse_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_goal int := 60;
  v_sales_count int := 0;
  v_sales_sum numeric := 0;
  v_barcode int := 0;
  v_typeahead int := 0;
  v_other int := 0;
  v_shifts_open int := 0;
  v_shifts_closed int := 0;
  v_by_user jsonb := '[]'::jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not public.is_tenant_member(p_tenant_id) then
    raise exception 'not authorized'
      using errcode = '42501';
  end if;

  select coalesce(g.daily_sales_target, 60)
  into v_goal
  from public.pos_adoption_goals g
  where g.tenant_id = p_tenant_id;

  if not found then
    v_goal := 60;
  end if;

  select
    count(*)::int,
    coalesce(sum(s.total_gross), 0)
  into v_sales_count, v_sales_sum
  from public.sales_orders s
  where s.tenant_id = p_tenant_id
    and s.deleted_at is null
    and s.pos_shift_id is not null
    and s.status not in ('cancelled', 'returned')
    and s.created_at >= p_from
    and s.created_at < p_to
    and (
      p_warehouse_id is null
      or exists (
        select 1
        from public.pos_shifts sh
        where sh.id = s.pos_shift_id
          and sh.warehouse_id = p_warehouse_id
      )
    );

  select
    count(*) filter (where e.source = 'barcode'),
    count(*) filter (where e.source = 'typeahead'),
    count(*) filter (where e.source not in ('barcode', 'typeahead'))
  into v_barcode, v_typeahead, v_other
  from public.pos_scan_events e
  where e.tenant_id = p_tenant_id
    and e.created_at >= p_from
    and e.created_at < p_to
    and (p_warehouse_id is null or e.warehouse_id = p_warehouse_id);

  select
    count(*) filter (where sh.status = 'open'),
    count(*) filter (where sh.status = 'closed')
  into v_shifts_open, v_shifts_closed
  from public.pos_shifts sh
  where sh.tenant_id = p_tenant_id
    and sh.opened_at >= p_from
    and sh.opened_at < p_to
    and (p_warehouse_id is null or sh.warehouse_id = p_warehouse_id);

  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.sales_count desc), '[]'::jsonb)
  into v_by_user
  from (
    select
      coalesce(nullif(btrim(s.created_by_label_snapshot), ''), 'Ismeretlen') as user_label,
      s.created_by as user_id,
      count(*)::int as sales_count,
      coalesce(sum(s.total_gross), 0)::numeric as sales_sum
    from public.sales_orders s
    where s.tenant_id = p_tenant_id
      and s.deleted_at is null
      and s.pos_shift_id is not null
      and s.status not in ('cancelled', 'returned')
      and s.created_at >= p_from
      and s.created_at < p_to
      and (
        p_warehouse_id is null
        or exists (
          select 1 from public.pos_shifts sh
          where sh.id = s.pos_shift_id and sh.warehouse_id = p_warehouse_id
        )
      )
    group by s.created_by, coalesce(nullif(btrim(s.created_by_label_snapshot), ''), 'Ismeretlen')
    order by count(*) desc
    limit 25
  ) t;

  return jsonb_build_object(
    'daily_sales_target', v_goal,
    'sales_count', v_sales_count,
    'sales_sum', v_sales_sum,
    'barcode_scans', coalesce(v_barcode, 0),
    'typeahead_picks', coalesce(v_typeahead, 0),
    'other_picks', coalesce(v_other, 0),
    'shifts_open', coalesce(v_shifts_open, 0),
    'shifts_closed', coalesce(v_shifts_closed, 0),
    'by_user', v_by_user
  );
end;
$$;

revoke all on function public.pos_adoption_stats(uuid, timestamptz, timestamptz, uuid) from public;
grant execute on function public.pos_adoption_stats(uuid, timestamptz, timestamptz, uuid) to authenticated;
grant execute on function public.pos_adoption_stats(uuid, timestamptz, timestamptz, uuid) to service_role;

comment on function public.pos_adoption_stats is
  'POS adoption snapshot: sales with pos_shift_id, scan mix, by-user (limit 25). Default daily goal 60.';
