-- =============================================================================
-- Turinova Admin — App Store Review demó tenant + seed
-- Útmutató: vezetoi-mobile/docs/app-store-review-demo.md
--
-- ELŐFELTÉTEL: Auth user létezik (Dashboard → Add user):
--   email: review@turinova.hu
--   confirmed, MFA nélkül
--
-- Futtasd a Supabase SQL Editorben (éles projekt). Idempotens.
-- =============================================================================

do $$
declare
  v_email text := 'review@turinova.hu';
  v_tenant_slug text := 'app-store-review';
  v_tenant_name text := 'Turinova Review Demo';
  v_tenant_id uuid;
  v_user_id uuid;
  v_customer_id uuid;
  v_device_id uuid;
  v_type_bolt uuid;
  v_type_muhely uuid;
  v_type_iroda uuid;
  v_emp record;
  v_today date := (timezone('Europe/Budapest', now()))::date;
  v_day date;
  v_i int;
  v_hour int;
  v_names text[] := array[
    'Nagy Anna',
    'Kovács Péter',
    'Szabó Eszter',
    'Tóth Gábor',
    'Horváth Réka',
    'Varga István',
    'Kiss Júlia',
    'Molnár Dániel'
  ];
  v_codes text[] := array['A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A08'];
  v_type_codes text[] := array['bolt', 'muhely', 'iroda', 'muhely', 'bolt', 'lapszabasz', 'iroda', 'muhely'];
  v_emp_ids uuid[] := array[]::uuid[];
  v_eid uuid;
  v_arrival time;
  v_depart time;
  v_q_net numeric;
  v_q_vat numeric;
  v_q_gross numeric;
begin
  -- ---------------------------------------------------------------------------
  -- 1) Auth user
  -- ---------------------------------------------------------------------------
  select id into v_user_id
  from auth.users
  where lower(email) = lower(v_email)
  limit 1;

  if v_user_id is null then
    raise exception
      'Nincs Auth user: %. Előbb: Authentication → Users → Add user (Auto Confirm, MFA nélkül).',
      v_email;
  end if;

  -- Partner profil tiltás (vezetői app kiléptetné)
  delete from public.partner_profiles where user_id = v_user_id;

  -- ---------------------------------------------------------------------------
  -- 2) Tenant
  -- ---------------------------------------------------------------------------
  select id into v_tenant_id
  from public.tenants
  where slug = v_tenant_slug
  limit 1;

  if v_tenant_id is null then
    insert into public.tenants (
      name,
      slug,
      status,
      max_seats,
      access_until,
      access_source
    )
    values (
      v_tenant_name,
      v_tenant_slug,
      'active',
      10,
      (v_today + 365),
      'manual'
    )
    returning id into v_tenant_id;
  else
    update public.tenants
    set
      name = v_tenant_name,
      status = 'active',
      access_until = greatest(coalesce(access_until, v_today), v_today + 365),
      access_source = coalesce(access_source, 'manual'),
      updated_at = now()
    where id = v_tenant_id;
  end if;

  -- ---------------------------------------------------------------------------
  -- 3) Membership (owner)
  -- ---------------------------------------------------------------------------
  insert into public.tenant_memberships (tenant_id, user_id, role, status)
  values (v_tenant_id, v_user_id, 'owner', 'active')
  on conflict (tenant_id, user_id) do update
  set role = 'owner', status = 'active';

  -- ---------------------------------------------------------------------------
  -- 4) Entitlements (mobil flagek + lapszabászat oldalak)
  -- ---------------------------------------------------------------------------
  insert into public.tenant_entitlements (tenant_id, feature_key)
  select v_tenant_id, f.key
  from (
    values
      ('jelenlet'),
      ('/jelenlet'),
      ('/dolgozok'),
      ('footcounter'),
      ('/belepok'),
      ('/ajanlatok'),
      ('/opti'),
      ('lapszabaszat')
  ) as f(key)
  where exists (select 1 from public.product_features pf where pf.key = f.key)
  on conflict do nothing;

  -- lapszabaszat feature néha csak page key-ként létezik — biztosítsuk az oldalakat
  insert into public.tenant_entitlements (tenant_id, feature_key)
  select v_tenant_id, f.key
  from (values ('/ajanlatok'), ('/opti')) as f(key)
  where exists (select 1 from public.product_features pf where pf.key = f.key)
  on conflict do nothing;

  -- Add-on link (ha van product_addons) — platform UI konzisztencia
  insert into public.tenant_addons (tenant_id, addon_id)
  select v_tenant_id, a.id
  from public.product_addons a
  where a.key in ('jelenlet', 'footcounter')
  on conflict do nothing;

  -- ---------------------------------------------------------------------------
  -- 5) Jelenlét: típusok + dolgozók + napok
  -- ---------------------------------------------------------------------------
  perform public.seed_hr_employee_types_for_tenant(v_tenant_id);

  select id into v_type_bolt
  from public.hr_employee_types
  where tenant_id = v_tenant_id and deleted_at is null and lower(code) = 'bolt'
  limit 1;
  select id into v_type_muhely
  from public.hr_employee_types
  where tenant_id = v_tenant_id and deleted_at is null and lower(code) = 'muhely'
  limit 1;
  select id into v_type_iroda
  from public.hr_employee_types
  where tenant_id = v_tenant_id and deleted_at is null and lower(code) = 'iroda'
  limit 1;

  -- Régi demó dolgozók törlése (újraseed)
  delete from public.hr_attendance_days
  where tenant_id = v_tenant_id
    and employee_id in (
      select id from public.hr_employees
      where tenant_id = v_tenant_id and code like 'A0%'
    );
  delete from public.hr_absences
  where tenant_id = v_tenant_id
    and employee_id in (
      select id from public.hr_employees
      where tenant_id = v_tenant_id and code like 'A0%'
    );
  delete from public.hr_employees
  where tenant_id = v_tenant_id and code like 'A0%';

  for v_i in 1..array_length(v_names, 1) loop
    insert into public.hr_employees (
      tenant_id,
      name,
      code,
      employee_type_id,
      active,
      shift_start,
      shift_end,
      lunch_start,
      lunch_end,
      works_on_saturday,
      timezone
    )
    values (
      v_tenant_id,
      v_names[v_i],
      v_codes[v_i],
      case v_type_codes[v_i]
        when 'bolt' then v_type_bolt
        when 'muhely' then v_type_muhely
        when 'lapszabasz' then coalesce(
          (select id from public.hr_employee_types
           where tenant_id = v_tenant_id and deleted_at is null and lower(code) = 'lapszabasz'
           limit 1),
          v_type_muhely
        )
        else v_type_iroda
      end,
      true,
      time '08:00',
      time '16:30',
      time '12:00',
      time '12:30',
      false,
      'Europe/Budapest'
    )
    returning id into v_eid;
    v_emp_ids := array_append(v_emp_ids, v_eid);
  end loop;

  -- Elmúlt 7 nap + ma attendance
  for v_i in 0..7 loop
    v_day := v_today - v_i;
    -- hétvége kihagyás (vasárnap mindig; szombat is)
    if extract(isodow from v_day) in (6, 7) then
      continue;
    end if;

    foreach v_eid in array v_emp_ids loop
      -- ~80% megjelenik
      if (hashtext(v_eid::text || v_day::text) % 10) < 8 then
        v_arrival := (time '07:45' + make_interval(mins => abs(hashtext(v_eid::text || 'a' || v_day::text)) % 40));
        if v_day = v_today then
          -- ma: többség még bent (nincs távozás)
          if (hashtext(v_eid::text || 'dep') % 10) < 3 then
            v_depart := time '16:05';
          else
            v_depart := null;
          end if;
        else
          v_depart := (time '16:00' + make_interval(mins => abs(hashtext(v_eid::text || 'd' || v_day::text)) % 45));
        end if;

        insert into public.hr_attendance_days (
          tenant_id,
          employee_id,
          work_date,
          arrival_time,
          departure_time,
          lunch_start,
          lunch_end,
          source,
          manually_edited,
          note
        )
        values (
          v_tenant_id,
          v_eid,
          v_day,
          v_arrival,
          v_depart,
          time '12:00',
          time '12:30',
          'manual',
          true,
          'App Store review seed'
        )
        on conflict (employee_id, work_date) do update
        set
          arrival_time = excluded.arrival_time,
          departure_time = excluded.departure_time,
          lunch_start = excluded.lunch_start,
          lunch_end = excluded.lunch_end,
          note = excluded.note,
          updated_at = now();
      end if;
    end loop;
  end loop;

  -- 1 szabadságos a jövő héten (látszódjon a fajta)
  delete from public.hr_absences
  where tenant_id = v_tenant_id and note = 'Review seed';
  insert into public.hr_absences (
    tenant_id, employee_id, start_date, end_date, absence_type, note
  )
  values (
    v_tenant_id,
    v_emp_ids[1],
    v_today + 3,
    v_today + 5,
    'vacation',
    'Review seed'
  );

  -- ---------------------------------------------------------------------------
  -- 6) Belépők: settings + device + crossings
  -- ---------------------------------------------------------------------------
  insert into public.footcounter_settings (
    tenant_id,
    weekday_open_hour,
    weekday_close_hour,
    saturday_open_hour,
    saturday_close_hour
  )
  values (v_tenant_id, 8, 17, 8, 13)
  on conflict (tenant_id) do update
  set
    weekday_open_hour = excluded.weekday_open_hour,
    weekday_close_hour = excluded.weekday_close_hour,
    saturday_open_hour = excluded.saturday_open_hour,
    saturday_close_hour = excluded.saturday_close_hour,
    updated_at = now();

  delete from public.footcounter_crossings
  where device_id in (
    select id from public.footcounter_devices where tenant_id = v_tenant_id and slug = 'review-bolt'
  );
  delete from public.footcounter_devices
  where tenant_id = v_tenant_id and slug = 'review-bolt';

  insert into public.footcounter_devices (
    tenant_id, slug, name, last_seen_at, updated_at
  )
  values (
    v_tenant_id,
    'review-bolt',
    'Review bolt bejárat',
    now(),
    now()
  )
  returning id into v_device_id;

  -- Ma: nyitvatartáson belüli in/out
  for v_hour in 8..least(extract(hour from timezone('Europe/Budapest', now()))::int, 16) loop
    for v_i in 1..(4 + abs(hashtext('in' || v_hour::text || v_today::text)) % 6) loop
      insert into public.footcounter_crossings (
        device_id, client_event_id, occurred_at, direction, confidence
      )
      values (
        v_device_id,
        gen_random_uuid(),
        ((v_today::timestamp + make_interval(hours => v_hour, mins => (v_i * 7) % 55))
          at time zone 'Europe/Budapest'),
        'in',
        0.9
      );
    end loop;
    for v_i in 1..(2 + abs(hashtext('out' || v_hour::text || v_today::text)) % 4) loop
      insert into public.footcounter_crossings (
        device_id, client_event_id, occurred_at, direction, confidence
      )
      values (
        v_device_id,
        gen_random_uuid(),
        ((v_today::timestamp + make_interval(hours => v_hour, mins => 3 + (v_i * 9) % 50))
          at time zone 'Europe/Budapest'),
        'out',
        0.85
      );
    end loop;
  end loop;

  -- Előző 6 munkanap
  for v_i in 1..10 loop
    v_day := v_today - v_i;
    if extract(isodow from v_day) in (6, 7) then
      continue;
    end if;
    for v_hour in 8..16 loop
      insert into public.footcounter_crossings (
        device_id, client_event_id, occurred_at, direction, confidence
      )
      select
        v_device_id,
        gen_random_uuid(),
        ((v_day::timestamp + make_interval(hours => v_hour, mins => g * 11))
          at time zone 'Europe/Budapest'),
        case when g % 3 = 0 then 'out' else 'in' end,
        0.8
      from generate_series(0, 3 + abs(hashtext(v_day::text || v_hour::text)) % 5) as g;
    end loop;
  end loop;

  -- ---------------------------------------------------------------------------
  -- 7) Lapszabászat: customer + quotes (ajánlat + rendelés)
  -- ---------------------------------------------------------------------------
  select id into v_customer_id
  from public.customers
  where tenant_id = v_tenant_id
    and deleted_at is null
    and lower(name) = lower('Review Demó Ügyfél')
  limit 1;

  if v_customer_id is null then
    insert into public.customers (tenant_id, name, email, mobile, billing_city)
    values (v_tenant_id, 'Review Demó Ügyfél', 'ugyfel@review-demo.hu', '+36301234567', 'Budapest')
    returning id into v_customer_id;
  end if;

  -- Régi review quote-ok törlése
  delete from public.quotes
  where tenant_id = v_tenant_id
    and quote_number like 'ASR-%';

  -- Ajánlatok (staff, created_at ma / közelmúlt) — Kezdőlap Ajánlatok
  for v_i in 0..4 loop
    v_q_net := 80000 + v_i * 25000;
    v_q_vat := round(v_q_net * 0.27);
    v_q_gross := v_q_net + v_q_vat;
    insert into public.quotes (
      tenant_id,
      customer_id,
      quote_number,
      order_number,
      status,
      source,
      total_net,
      total_vat,
      total_gross,
      final_total_gross,
      created_by,
      created_at,
      updated_at,
      ordered_at
    )
    values (
      v_tenant_id,
      v_customer_id,
      'ASR-Q-' || lpad(v_i::text, 3, '0'),
      null,
      'draft',
      'opti',
      v_q_net,
      v_q_vat,
      v_q_gross,
      v_q_gross,
      v_user_id,
      (((v_today - (v_i % 3))::timestamp + make_interval(hours => 10 + v_i))
        at time zone 'Europe/Budapest'),
      now(),
      null
    );
  end loop;

  -- Megrendelések (order_number + ordered_at) — Kezdőlap Rendelt
  for v_i in 0..8 loop
    v_day := v_today - (v_i % 6);
    if extract(isodow from v_day) in (6, 7) then
      v_day := v_day - 2;
    end if;
    v_q_net := 120000 + v_i * 45000;
    v_q_vat := round(v_q_net * 0.27);
    v_q_gross := v_q_net + v_q_vat;
    insert into public.quotes (
      tenant_id,
      customer_id,
      quote_number,
      order_number,
      status,
      source,
      total_net,
      total_vat,
      total_gross,
      final_total_gross,
      created_by,
      created_at,
      updated_at,
      ordered_at
    )
    values (
      v_tenant_id,
      v_customer_id,
      'ASR-O-Q-' || lpad(v_i::text, 3, '0'),
      'ASR-O-' || lpad(v_i::text, 3, '0'),
      'ordered',
      case when v_i % 4 = 0 then 'portal' else 'opti' end,
      v_q_net,
      v_q_vat,
      v_q_gross,
      v_q_gross,
      v_user_id,
      ((v_day::timestamp + make_interval(hours => 9 + (v_i % 6)))
        at time zone 'Europe/Budapest'),
      now(),
      ((v_day::timestamp + make_interval(hours => 11 + (v_i % 5)))
        at time zone 'Europe/Budapest')
    );
  end loop;

  raise notice 'OK review seed | tenant_id=% | user_id=% | email=% | slug=%',
    v_tenant_id, v_user_id, v_email, v_tenant_slug;
end $$;

-- Gyors ellenőrző lekérdezés (a DO után külön eredmény)
select
  t.id as tenant_id,
  t.name,
  t.slug,
  t.status,
  u.email,
  m.role,
  m.status as membership_status,
  (select count(*) from public.hr_employees e where e.tenant_id = t.id and e.code like 'A0%') as employees,
  (select count(*) from public.hr_attendance_days d where d.tenant_id = t.id and d.work_date = (timezone('Europe/Budapest', now()))::date) as attendance_today,
  (select count(*) from public.footcounter_crossings c
     join public.footcounter_devices d on d.id = c.device_id
    where d.tenant_id = t.id) as crossings,
  (select count(*) from public.quotes q where q.tenant_id = t.id and q.quote_number like 'ASR-%') as quotes
from public.tenants t
join public.tenant_memberships m on m.tenant_id = t.id
join auth.users u on u.id = m.user_id
where t.slug = 'app-store-review'
  and lower(u.email) = 'review@turinova.hu';
