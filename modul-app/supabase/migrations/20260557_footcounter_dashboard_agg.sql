-- Belépők dashboard: DB-oldali aggregáció (ne húzzunk le 12 hó raw crossinget).
-- Index: (device_id, occurred_at) már van (20260429).

create or replace function public.footcounter_dashboard_agg(
  p_tenant_id uuid,
  p_year int,
  p_month int
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set statement_timeout = '12s'
as $$
declare
  v_month_start date;
  v_month_end date;
  v_prev_start date;
  v_prev_end date;
  v_season_start date;
  v_today date;
  v_lookback date;
  v_range_start timestamptz;
  v_range_end timestamptz;
  v_device_ids uuid[];
  v_result jsonb;
begin
  if not public.is_tenant_member(p_tenant_id) then
    raise exception 'not authorized for tenant footcounter'
      using errcode = '42501';
  end if;

  if p_year is null or p_month is null
     or p_month < 1 or p_month > 12
     or p_year < 2020 or p_year > 2100 then
    raise exception 'invalid year/month';
  end if;

  v_month_start := make_date(p_year, p_month, 1);
  v_month_end := (v_month_start + interval '1 month')::date;
  v_prev_end := v_month_start;
  v_prev_start := (v_month_start - interval '1 month')::date;
  v_season_start := (v_month_start - interval '11 months')::date;
  v_today := (timezone('Europe/Budapest', now()))::date;
  v_lookback := v_today - 70;

  v_range_start := least(v_season_start, v_lookback, v_prev_start)::timestamp
    AT TIME ZONE 'Europe/Budapest';
  v_range_end := greatest(v_month_end, v_today + 1)::timestamp
    AT TIME ZONE 'Europe/Budapest';

  select coalesce(array_agg(d.id), '{}'::uuid[])
    into v_device_ids
  from public.footcounter_devices d
  where d.tenant_id = p_tenant_id;

  if coalesce(cardinality(v_device_ids), 0) = 0 then
    return jsonb_build_object(
      'empty', true,
      'today_in_by_hour', '[]'::jsonb,
      'today_out_by_hour', '[]'::jsonb,
      'today_in', 0,
      'today_out', 0,
      'month_days', '[]'::jsonb,
      'month_hours', '[]'::jsonb,
      'season_months', '[]'::jsonb,
      'heat_days', '[]'::jsonb,
      'lookback_days', '[]'::jsonb,
      'prev_month_total_in', 0
    );
  end if;

  with base as (
    select
      c.direction,
      (timezone('Europe/Budapest', c.occurred_at))::date as day_bp,
      extract(hour from timezone('Europe/Budapest', c.occurred_at))::int as hour_bp
    from public.footcounter_crossings c
    where c.device_id = any (v_device_ids)
      and c.occurred_at >= v_range_start
      and c.occurred_at < v_range_end
      and c.direction in ('in', 'out')
  ),
  today_hours as (
    select
      hour_bp,
      count(*) filter (where direction = 'in')::int as in_c,
      count(*) filter (where direction = 'out')::int as out_c
    from base
    where day_bp = v_today
    group by hour_bp
  ),
  today_in_arr as (
    select coalesce(
      jsonb_agg(coalesce(t.in_c, 0) order by h.h),
      '[]'::jsonb
    ) as arr
    from generate_series(0, 23) as h(h)
    left join today_hours t on t.hour_bp = h.h
  ),
  today_out_arr as (
    select coalesce(
      jsonb_agg(coalesce(t.out_c, 0) order by h.h),
      '[]'::jsonb
    ) as arr
    from generate_series(0, 23) as h(h)
    left join today_hours t on t.hour_bp = h.h
  ),
  today_tot as (
    select
      coalesce(sum(in_c), 0)::int as today_in,
      coalesce(sum(out_c), 0)::int as today_out
    from today_hours
  ),
  month_days as (
    select
      extract(day from day_bp)::int as d,
      count(*)::int as c
    from base
    where direction = 'in'
      and day_bp >= v_month_start
      and day_bp < v_month_end
    group by 1
  ),
  month_hours as (
    select
      hour_bp as h,
      count(*)::int as c
    from base
    where direction = 'in'
      and day_bp >= v_month_start
      and day_bp < v_month_end
    group by 1
  ),
  season_months as (
    select
      to_char(day_bp, 'YYYY-MM') as ym,
      count(*)::int as c
    from base
    where direction = 'in'
      and day_bp >= v_season_start
      and day_bp < v_month_end
    group by 1
  ),
  heat_days as (
    select
      to_char(day_bp, 'YYYY-MM-DD') as day_key,
      hour_bp as h,
      count(*)::int as c
    from base
    where direction = 'in'
      and day_bp >= v_month_start
      and day_bp < v_month_end
    group by 1, 2
  ),
  lookback_days as (
    select
      to_char(day_bp, 'YYYY-MM-DD') as day_key,
      count(*)::int as c
    from base
    where direction = 'in'
      and day_bp >= v_lookback
      and day_bp < v_today
    group by 1
  ),
  prev_tot as (
    select coalesce(count(*), 0)::int as c
    from base
    where direction = 'in'
      and day_bp >= v_prev_start
      and day_bp < v_prev_end
  )
  select jsonb_build_object(
    'empty', false,
    'today_in_by_hour', (select arr from today_in_arr),
    'today_out_by_hour', (select arr from today_out_arr),
    'today_in', (select today_in from today_tot),
    'today_out', (select today_out from today_tot),
    'month_days', coalesce(
      (select jsonb_agg(jsonb_build_object('d', d, 'c', c) order by d) from month_days),
      '[]'::jsonb
    ),
    'month_hours', coalesce(
      (select jsonb_agg(jsonb_build_object('h', h, 'c', c) order by h) from month_hours),
      '[]'::jsonb
    ),
    'season_months', coalesce(
      (select jsonb_agg(jsonb_build_object('ym', ym, 'c', c) order by ym) from season_months),
      '[]'::jsonb
    ),
    'heat_days', coalesce(
      (select jsonb_agg(jsonb_build_object('day_key', day_key, 'h', h, 'c', c)) from heat_days),
      '[]'::jsonb
    ),
    'lookback_days', coalesce(
      (select jsonb_agg(jsonb_build_object('day_key', day_key, 'c', c)) from lookback_days),
      '[]'::jsonb
    ),
    'prev_month_total_in', (select c from prev_tot)
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.footcounter_dashboard_agg(uuid, int, int) from public;
grant execute on function public.footcounter_dashboard_agg(uuid, int, int) to authenticated;

comment on function public.footcounter_dashboard_agg(uuid, int, int) is
  'Belépők /belepok dashboard aggregates (Budapest TZ) — replaces raw crossing dump.';

-- Home widget: mai IN/OUT + órás IN (kis range).
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
        count(*) filter (where direction = 'in')::int as in_c
      from base
      group by hour_bp
    ),
    hourly as (
      select coalesce(
        jsonb_agg(coalesce(h.in_c, 0) order by g.g),
        '[]'::jsonb
      ) as arr
      from generate_series(0, 23) as g(g)
      left join hours h on h.hour_bp = g.g
    )
    select jsonb_build_object(
      'today_in', (select count(*)::int from base where direction = 'in'),
      'today_out', (select count(*)::int from base where direction = 'out'),
      'hourly_in', (select arr from hourly),
      'last_event_at', (select max(occurred_at) from base)
    )
  );
end;
$$;

revoke all on function public.footcounter_today_slim_agg(uuid) from public;
grant execute on function public.footcounter_today_slim_agg(uuid) to authenticated;

-- Per-device mai stat (API /belepok live).
create or replace function public.footcounter_today_by_device_agg(p_tenant_id uuid)
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
begin
  if not public.is_tenant_member(p_tenant_id) then
    raise exception 'not authorized for tenant footcounter'
      using errcode = '42501';
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'device_id', d.id,
          'slug', d.slug,
          'name', coalesce(nullif(d.name, ''), d.slug),
          'last_seen_at', d.last_seen_at,
          'today_in', coalesce(x.in_c, 0),
          'today_out', coalesce(x.out_c, 0)
        )
        order by d.created_at
      )
      from public.footcounter_devices d
      left join lateral (
        select
          count(*) filter (where c.direction = 'in')::int as in_c,
          count(*) filter (where c.direction = 'out')::int as out_c
        from public.footcounter_crossings c
        where c.device_id = d.id
          and c.occurred_at >= v_start
          and c.occurred_at < v_end
      ) x on true
      where d.tenant_id = p_tenant_id
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.footcounter_today_by_device_agg(uuid) from public;
grant execute on function public.footcounter_today_by_device_agg(uuid) to authenticated;
