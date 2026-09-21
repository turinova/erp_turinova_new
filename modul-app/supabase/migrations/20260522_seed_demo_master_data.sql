-- Demó törzs + katalógus feltöltés egy tenantre (platform gomb / create checkbox).
-- SQL rész: ÁFA, cég, fizetés, egység, díj, gyártó, gép, raktár, HR…
-- Katalógus (tábla / él / szálas / termék + képek): TypeScript seedDemoCatalog
--   (public/images/demo-seed/) — ugyanaz a gomb / flow.

create or replace function public.demo_master_has_data(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from public.units u
      where u.tenant_id = p_tenant_id and u.deleted_at is null
    )
    and exists (
      select 1 from public.payment_methods pm
      where pm.tenant_id = p_tenant_id and pm.deleted_at is null
    )
    and exists (
      select 1 from public.fee_types ft
      where ft.tenant_id = p_tenant_id and ft.deleted_at is null
    )
    and exists (
      select 1 from public.manufacturers m
      where m.tenant_id = p_tenant_id and m.deleted_at is null
    );
$$;

revoke all on function public.demo_master_has_data(uuid) from public;
revoke all on function public.demo_master_has_data(uuid) from authenticated;
grant execute on function public.demo_master_has_data(uuid) to service_role;

create or replace function public.seed_demo_master_data(p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant public.tenants%rowtype;
  v_tax_27 uuid;
  v_tax_0 uuid;
  v_pm_transfer uuid;
  v_created int := 0;
begin
  select * into v_tenant
  from public.tenants
  where id = p_tenant_id;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'A cég nem található.');
  end if;

  if public.demo_master_has_data(p_tenant_id) then
    return jsonb_build_object(
      'ok', true,
      'skipped', true,
      'message', 'Már van törzsadat.'
    );
  end if;

  -- -------------------------------------------------------------------------
  -- Adónemek
  -- -------------------------------------------------------------------------
  insert into public.tax_rates (tenant_id, name, rate_percent, is_default)
  select p_tenant_id, v.name, v.rate_percent, v.is_default
  from (
    values
      ('ÁFA 0%', 0::numeric, false),
      ('ÁFA 5%', 5::numeric, false),
      ('ÁFA 27%', 27::numeric, true)
  ) as v(name, rate_percent, is_default)
  where not exists (
    select 1 from public.tax_rates r
    where r.tenant_id = p_tenant_id
      and r.deleted_at is null
      and lower(r.name) = lower(v.name)
  );
  get diagnostics v_created = row_count;

  -- Ha már volt 27% default nélkül / dupla default: egy default
  update public.tax_rates
  set is_default = false
  where tenant_id = p_tenant_id
    and deleted_at is null
    and is_default = true
    and rate_percent <> 27;

  update public.tax_rates
  set is_default = true
  where tenant_id = p_tenant_id
    and deleted_at is null
    and rate_percent = 27
    and name = 'ÁFA 27%';

  select id into v_tax_27
  from public.tax_rates
  where tenant_id = p_tenant_id
    and deleted_at is null
    and rate_percent = 27
  order by is_default desc
  limit 1;

  select id into v_tax_0
  from public.tax_rates
  where tenant_id = p_tenant_id
    and deleted_at is null
    and rate_percent = 0
  limit 1;

  if v_tax_27 is null then
    return jsonb_build_object('ok', false, 'message', 'ÁFA 27% hiányzik.');
  end if;

  -- -------------------------------------------------------------------------
  -- Cégadatok (Kecskemét) — logo_url-t a platform action tölti
  -- -------------------------------------------------------------------------
  insert into public.tenant_companies (
    tenant_id,
    name,
    country,
    postal_code,
    city,
    address,
    phone_number,
    email,
    website,
    tax_number,
    company_registration_number,
    vat_id,
    quote_validity_days
  )
  values (
    p_tenant_id,
    v_tenant.name,
    'Magyarország',
    '6000',
    'Kecskemét',
    'Izsáki út 12.',
    '+36 76 500 100',
    'info@' || v_tenant.slug || '.hu',
    'https://www.' || v_tenant.slug || '.hu',
    '12345678-2-03',
    '03-09-123456',
    'HU12345678',
    30
  )
  on conflict (tenant_id) do update
  set
    name = excluded.name,
    country = excluded.country,
    postal_code = coalesce(public.tenant_companies.postal_code, excluded.postal_code),
    city = coalesce(public.tenant_companies.city, excluded.city),
    address = coalesce(public.tenant_companies.address, excluded.address),
    phone_number = coalesce(public.tenant_companies.phone_number, excluded.phone_number),
    email = coalesce(public.tenant_companies.email, excluded.email),
    website = coalesce(public.tenant_companies.website, excluded.website),
    tax_number = coalesce(public.tenant_companies.tax_number, excluded.tax_number),
    company_registration_number = coalesce(
      public.tenant_companies.company_registration_number,
      excluded.company_registration_number
    ),
    vat_id = coalesce(public.tenant_companies.vat_id, excluded.vat_id),
    quote_validity_days = coalesce(
      public.tenant_companies.quote_validity_days,
      excluded.quote_validity_days
    ),
    updated_at = now();

  -- -------------------------------------------------------------------------
  -- Fizetési módok
  -- -------------------------------------------------------------------------
  insert into public.payment_methods (tenant_id, name, active)
  select p_tenant_id, v.name, true
  from (
    values
      ('Készpénz'),
      ('Átutalás'),
      ('Bankkártya'),
      ('SZÉP kártya'),
      ('Utánvét')
  ) as v(name)
  where not exists (
    select 1 from public.payment_methods pm
    where pm.tenant_id = p_tenant_id
      and pm.deleted_at is null
      and lower(pm.name) = lower(v.name)
  );

  select id into v_pm_transfer
  from public.payment_methods
  where tenant_id = p_tenant_id
    and deleted_at is null
    and lower(name) = 'átutalás'
  limit 1;

  -- -------------------------------------------------------------------------
  -- Egységek
  -- -------------------------------------------------------------------------
  insert into public.units (tenant_id, name, shortform)
  select p_tenant_id, v.name, v.shortform
  from (
    values
      ('Darab', 'db'),
      ('Méter', 'm'),
      ('Folyóméter', 'fm'),
      ('Négyzetméter', 'm²'),
      ('Kilogramm', 'kg'),
      ('Óra', 'óra'),
      ('Csomag', 'csom'),
      ('Lap', 'lap')
  ) as v(name, shortform)
  where not exists (
    select 1 from public.units u
    where u.tenant_id = p_tenant_id
      and u.deleted_at is null
      and lower(u.name) = lower(v.name)
  );

  -- -------------------------------------------------------------------------
  -- Díjtípusok (unit_id NOT NULL — Darab / Óra)
  -- -------------------------------------------------------------------------
  insert into public.fee_types (
    tenant_id, tax_rate_id, unit_id, name, price_net, active
  )
  select p_tenant_id, v_tax_27, u.id, v.name, v.price_net, true
  from (
    values
      ('Szállítás', 8000::numeric, 'db'),
      ('Csomagolás', 2500::numeric, 'db'),
      ('Beszerelés', 15000::numeric, 'óra')
  ) as v(name, price_net, unit_short)
  inner join public.units u
    on u.tenant_id = p_tenant_id
   and u.deleted_at is null
   and lower(u.shortform) = lower(v.unit_short)
  where not exists (
    select 1 from public.fee_types ft
    where ft.tenant_id = p_tenant_id
      and ft.deleted_at is null
      and lower(ft.name) = lower(v.name)
  );

  if not exists (
    select 1 from public.fee_types ft
    where ft.tenant_id = p_tenant_id
      and ft.deleted_at is null
  ) then
    return jsonb_build_object(
      'ok', false,
      'message', 'Díjtípusok nem jöttek létre (egység hiányzik).'
    );
  end if;

  -- -------------------------------------------------------------------------
  -- Gyártók
  -- -------------------------------------------------------------------------
  insert into public.manufacturers (tenant_id, name)
  select p_tenant_id, v.name
  from (
    values
      ('Egger'),
      ('Falco'),
      ('Hranipex'),
      ('Kronospan')
  ) as v(name)
  where not exists (
    select 1 from public.manufacturers m
    where m.tenant_id = p_tenant_id
      and m.deleted_at is null
      and lower(m.name) = lower(v.name)
  );

  -- -------------------------------------------------------------------------
  -- Berendezés
  -- -------------------------------------------------------------------------
  insert into public.equipment (tenant_id, name, export_format)
  select p_tenant_id, 'Korpus', 'korpus'
  where not exists (
    select 1 from public.equipment e
    where e.tenant_id = p_tenant_id
      and e.deleted_at is null
      and lower(e.name) = 'korpus'
  );

  -- -------------------------------------------------------------------------
  -- Gyártógépek
  -- -------------------------------------------------------------------------
  insert into public.production_machines (
    tenant_id, name, usage_limit_per_day, active
  )
  select p_tenant_id, v.name, v.lim, true
  from (
    values
      ('SCM Gabbiani', 80),
      ('SCM Sigma', 60)
  ) as v(name, lim)
  where not exists (
    select 1 from public.production_machines pm
    where pm.tenant_id = p_tenant_id
      and pm.deleted_at is null
      and lower(pm.name) = lower(v.name)
  );

  -- -------------------------------------------------------------------------
  -- Raktár: Üzlet (Fő raktár triggerrel már van)
  -- -------------------------------------------------------------------------
  insert into public.warehouses (
    tenant_id, name, code, is_default, is_active, country, postal_code, city
  )
  select
    p_tenant_id,
    'Üzlet',
    'UZ',
    false,
    true,
    'Magyarország',
    '6000',
    'Kecskemét'
  where not exists (
    select 1 from public.warehouses w
    where w.tenant_id = p_tenant_id
      and w.deleted_at is null
      and lower(w.code) = 'uz'
  );

  -- -------------------------------------------------------------------------
  -- Pénztárak (ha a warehouse→register trigger még nincs / régi WH)
  -- -------------------------------------------------------------------------
  insert into public.pos_registers (
    tenant_id, warehouse_id, name, code, is_active, is_default
  )
  select
    w.tenant_id,
    w.id,
    'Főpénztár',
    'K-' || left(replace(w.id::text, '-', ''), 8),
    true,
    true
  from public.warehouses w
  where w.tenant_id = p_tenant_id
    and w.deleted_at is null
    and w.is_active = true
    and not exists (
      select 1
      from public.pos_registers r
      where r.warehouse_id = w.id
        and r.deleted_at is null
    )
    and not exists (
      select 1
      from public.pos_registers r
      where r.tenant_id = w.tenant_id
        and r.code = 'K-' || left(replace(w.id::text, '-', ''), 8)
        and r.deleted_at is null
    );

  -- -------------------------------------------------------------------------
  -- Vágási díj 500 Ft/m + 27%
  -- -------------------------------------------------------------------------
  insert into public.cutting_fees (tenant_id, fee_per_meter, tax_rate_id)
  select p_tenant_id, 500, v_tax_27
  where not exists (
    select 1 from public.cutting_fees cf
    where cf.tenant_id = p_tenant_id
      and cf.deleted_at is null
  );

  -- -------------------------------------------------------------------------
  -- SMS sablon (quote_ready)
  -- -------------------------------------------------------------------------
  insert into public.tenant_sms_templates (tenant_id, template_key, body, updated_at)
  values (
    p_tenant_id,
    'quote_ready',
    'Kedves {customer_name}! A rendelese elkeszult es atveheto. Anyagok: {material_name} Udvozlettel, {company_name}',
    now()
  )
  on conflict (tenant_id, template_key) do update
  set body = excluded.body,
      updated_at = now();

  -- -------------------------------------------------------------------------
  -- Ügyfelek
  -- -------------------------------------------------------------------------
  insert into public.customers (
    tenant_id,
    name,
    email,
    mobile,
    billing_name,
    billing_country,
    billing_city,
    billing_postal_code,
    billing_street,
    billing_house_number
  )
  select p_tenant_id, v.name, v.email, v.mobile, v.name, 'Magyarország',
         v.city, v.zip, v.street, v.house
  from (
    values
      (
        'Asztalos Partner Bt.',
        'info@asztalos-partner.hu',
        '+36 30 111 2233',
        'Budapest',
        '1117',
        'Budafoki út',
        '12'
      ),
      (
        'Bútorház Kft.',
        'rendeles@butorhaz.hu',
        '+36 20 444 5566',
        'Szeged',
        '6720',
        'Kárász utca',
        '5'
      ),
      (
        'Kovács János',
        'kovacs.janos@email.hu',
        '+36 70 999 0011',
        'Kecskemét',
        '6000',
        'Szabadság tér',
        '3'
      )
  ) as v(name, email, mobile, city, zip, street, house)
  where not exists (
    select 1 from public.customers c
    where c.tenant_id = p_tenant_id
      and c.deleted_at is null
      and lower(c.name) = lower(v.name)
  );

  -- -------------------------------------------------------------------------
  -- Beszállító
  -- -------------------------------------------------------------------------
  insert into public.suppliers (
    tenant_id,
    name,
    email,
    phone,
    status,
    default_currency,
    default_tax_rate_id,
    default_payment_method_id,
    default_payment_terms_days
  )
  select
    p_tenant_id,
    'Demó Lemez Nagyker Kft.',
    'vasarlas@lemez-nagyker.hu',
    '+36 1 555 0100',
    'active',
    'HUF',
    v_tax_27,
    v_pm_transfer,
    30
  where not exists (
    select 1 from public.suppliers s
    where s.tenant_id = p_tenant_id
      and s.deleted_at is null
      and lower(s.name) = 'demó lemez nagyker kft.'
  );

  -- -------------------------------------------------------------------------
  -- Jelenlét: típusok + ünnepek + dolgozók
  -- -------------------------------------------------------------------------
  perform public.seed_hr_employee_types_for_tenant(p_tenant_id);
  perform public.seed_hr_hu_holidays_for_tenant(p_tenant_id);

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
    timezone
  )
  select
    p_tenant_id,
    v.name,
    v.code,
    et.id,
    true,
    v.shift_start::time,
    v.shift_end::time,
    v.lunch_start::time,
    v.lunch_end::time,
    'Europe/Budapest'
  from (
    values
      ('Kovács Péter', 'KP01', 'muhely', '06:00', '14:30', '12:00', '12:30'),
      ('Nagy Anna', 'NA01', 'lapszabasz', '06:00', '14:30', '12:00', '12:30'),
      ('Szabó Gábor', 'SZG01', 'muhely', '06:00', '14:30', '12:00', '12:30'),
      ('Tóth Eszter', 'TE01', 'iroda', '08:00', '16:30', '12:00', '12:30'),
      ('Varga Dániel', 'VD01', 'bolt', '09:00', '17:30', '12:30', '13:00'),
      ('Kiss Kata', 'KK01', 'bolt', '09:00', '17:30', '12:30', '13:00')
  ) as v(name, code, type_code, shift_start, shift_end, lunch_start, lunch_end)
  join public.hr_employee_types et
    on et.tenant_id = p_tenant_id
    and et.deleted_at is null
    and et.code = v.type_code
  where not exists (
    select 1 from public.hr_employees e
    where e.tenant_id = p_tenant_id
      and lower(e.code) = lower(v.code)
  );

  return jsonb_build_object(
    'ok', true,
    'skipped', false,
    'message', 'Demó törzs kész.'
  );
end;
$$;

revoke all on function public.seed_demo_master_data(uuid) from public;
revoke all on function public.seed_demo_master_data(uuid) from authenticated;
grant execute on function public.seed_demo_master_data(uuid) to service_role;

comment on function public.seed_demo_master_data(uuid) is
  'Platform demó törzs: cég, ÁFA, fizetés, egység, díj, gyártó, Korpus, SCM gépek, SMS, ügyfél, beszállító, jelenlét dolgozók. Anyag/él/termék NINCS.';
