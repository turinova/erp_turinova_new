-- Belépők: tenant nyitvatartás (csak megjelenítés / KPI szűrés; sync raw marad).

create table if not exists public.footcounter_settings (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  weekday_open_hour smallint not null default 8
    check (weekday_open_hour >= 0 and weekday_open_hour <= 23),
  weekday_close_hour smallint not null default 17
    check (weekday_close_hour >= 0 and weekday_close_hour <= 23),
  saturday_open_hour smallint
    check (saturday_open_hour is null or (saturday_open_hour >= 0 and saturday_open_hour <= 23)),
  saturday_close_hour smallint
    check (saturday_close_hour is null or (saturday_close_hour >= 0 and saturday_close_hour <= 23)),
  updated_at timestamptz not null default now(),
  constraint footcounter_settings_weekday_range
    check (weekday_open_hour <= weekday_close_hour),
  constraint footcounter_settings_saturday_pair
    check (
      (saturday_open_hour is null and saturday_close_hour is null)
      or (
        saturday_open_hour is not null
        and saturday_close_hour is not null
        and saturday_open_hour <= saturday_close_hour
      )
    )
);

comment on table public.footcounter_settings is
  'Belépők chart/KPI nyitvatartás — display-only; crossings sync nem szűr.';

alter table public.footcounter_settings enable row level security;

drop policy if exists footcounter_settings_select_member on public.footcounter_settings;
create policy footcounter_settings_select_member
  on public.footcounter_settings
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists footcounter_settings_insert_member on public.footcounter_settings;
create policy footcounter_settings_insert_member
  on public.footcounter_settings
  for insert
  to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists footcounter_settings_update_member on public.footcounter_settings;
create policy footcounter_settings_update_member
  on public.footcounter_settings
  for update
  to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists footcounter_settings_platform_all on public.footcounter_settings;
create policy footcounter_settings_platform_all
  on public.footcounter_settings
  for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Home slim: hourly OUT is is, hogy a nyitvatartás-szűrt KPI konzisztens legyen.
create or replace function public.footcounter_today_slim_agg(p_tenant_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set statement_timeout = '6s'
as $$
declare
  v_today date := (timezone('Europe/Budapest', now()))::date;
  v_start timestamptz := (v_today::timestamp AT TIME ZONE 'Europe/Budapest');
  v_end timestamptz := ((v_today + 1)::timestamp AT TIME ZONE 'Europe/Budapest');
  v_device_ids uuid[];
begin
  if not public.is_tenant_member(p_tenant_id) then
    raise exception 'not authorized for tenant footcounter'
      using errcode = '42501';
  end if;

  select coalesce(array_agg(d.id), '{}'::uuid[])
    into v_device_ids
  from public.footcounter_devices d
  where d.tenant_id = p_tenant_id;

  if coalesce(cardinality(v_device_ids), 0) = 0 then
    return jsonb_build_object(
      'today_in', 0,
      'today_out', 0,
      'hourly_in', '[]'::jsonb,
      'hourly_out', '[]'::jsonb,
      'last_event_at', null
    );
  end if;

  return (
    with base as (
      select
        c.direction,
        c.occurred_at,
        extract(hour from timezone('Europe/Budapest', c.occurred_at))::int as hour_bp
      from public.footcounter_crossings c
      where c.device_id = any (v_device_ids)
        and c.occurred_at >= v_start
        and c.occurred_at < v_end
        and c.direction in ('in', 'out')
    ),
    hours as (
      select
        hour_bp,
        count(*) filter (where direction = 'in')::int as in_c,
        count(*) filter (where direction = 'out')::int as out_c
      from base
      group by hour_bp
    ),
    hourly_in as (
      select coalesce(
        jsonb_agg(coalesce(h.in_c, 0) order by g.g),
        '[]'::jsonb
      ) as arr
      from generate_series(0, 23) as g(g)
      left join hours h on h.hour_bp = g.g
    ),
    hourly_out as (
      select coalesce(
        jsonb_agg(coalesce(h.out_c, 0) order by g.g),
        '[]'::jsonb
      ) as arr
      from generate_series(0, 23) as g(g)
      left join hours h on h.hour_bp = g.g
    )
    select jsonb_build_object(
      'today_in', (select count(*)::int from base where direction = 'in'),
      'today_out', (select count(*)::int from base where direction = 'out'),
      'hourly_in', (select arr from hourly_in),
      'hourly_out', (select arr from hourly_out),
      'last_event_at', (select max(occurred_at) from base)
    )
  );
end;
$$;
