-- Seed: 1 demo tenant + membership + alap ÁFA kulcsok
-- 1) Hozz létre Auth usert a Supabase Dashboardon (Email + jelszó).
-- 2) Cseréld le a :seed_email értékket a te emailedre.
-- 3) Futtasd az SQL Editorben (postgres / service role).

-- Demo tenant
insert into public.tenants (name, slug, status)
values ('Demo Asztalos Kft.', 'demo', 'active')
on conflict (slug) do update
set name = excluded.name,
    status = excluded.status,
    updated_at = now();

-- Membership a megadott emailű userhez (owner)
insert into public.tenant_memberships (tenant_id, user_id, role)
select t.id, u.id, 'owner'
from public.tenants t
cross join auth.users u
where t.slug = 'demo'
  and lower(u.email) = lower('admin@turinova.hu') -- ← cseréld le
on conflict (tenant_id, user_id) do update
set role = excluded.role;

-- Alap ÁFA kulcsok a demo tenanthoz (ha még nincsenek)
insert into public.tax_rates (tenant_id, name, rate_percent, is_default)
select t.id, v.name, v.rate_percent, v.is_default
from public.tenants t
cross join (
  values
    ('ÁFA 0%', 0::numeric, false),
    ('ÁFA 5%', 5::numeric, false),
    ('ÁFA 27%', 27::numeric, true)
) as v(name, rate_percent, is_default)
where t.slug = 'demo'
  and not exists (
    select 1
    from public.tax_rates r
    where r.tenant_id = t.id
      and lower(r.name) = lower(v.name)
      and r.deleted_at is null
  );

-- Példa gyártók a demo tenanthoz
insert into public.manufacturers (tenant_id, name)
select t.id, v.name
from public.tenants t
cross join (
  values
    ('Blum'),
    ('Häfele')
) as v(name)
where t.slug = 'demo'
  and not exists (
    select 1
    from public.manufacturers m
    where m.tenant_id = t.id
      and lower(m.name) = lower(v.name)
      and m.deleted_at is null
  );

-- Példa berendezések a demo tenanthoz
insert into public.equipment (tenant_id, name, export_format)
select t.id, v.name, v.export_format
from public.tenants t
cross join (
  values
    ('CNC', 'korpus'),
    ('Élzáró gép', 'korpus')
) as v(name, export_format)
where t.slug = 'demo'
  and not exists (
    select 1
    from public.equipment e
    where e.tenant_id = t.id
      and lower(e.name) = lower(v.name)
      and e.deleted_at is null
  );

-- Példa élzáró (ha van gyártó + adó + berendezés)
insert into public.edge_materials (
  tenant_id,
  manufacturer_id,
  tax_rate_id,
  equipment_id,
  type,
  decor,
  width_mm,
  thickness_mm,
  price_net,
  allowance_mm,
  active,
  machine_code
)
select
  t.id,
  m.id,
  tr.id,
  eq.id,
  'ABS',
  'U708',
  23,
  1,
  700,
  0,
  true,
  'EDGE01'
from public.tenants t
join public.manufacturers m
  on m.tenant_id = t.id and lower(m.name) = 'blum' and m.deleted_at is null
join public.tax_rates tr
  on tr.tenant_id = t.id and tr.is_default = true and tr.deleted_at is null
join public.equipment eq
  on eq.tenant_id = t.id
  and lower(eq.name) = 'élzáró gép'
  and eq.deleted_at is null
where t.slug = 'demo'
  and not exists (
    select 1
    from public.edge_materials e
    where e.tenant_id = t.id
      and e.deleted_at is null
      and lower(e.type) = 'abs'
      and lower(e.decor) = 'u708'
  );

-- Meglévő élzárók equipment_id backfill (ha üres)
update public.edge_materials e
set equipment_id = eq.id
from public.tenants t
join public.equipment eq
  on eq.tenant_id = t.id
  and lower(eq.name) = 'élzáró gép'
  and eq.deleted_at is null
where t.slug = 'demo'
  and e.tenant_id = t.id
  and e.equipment_id is null;

-- Példa táblás anyag
insert into public.sheet_materials (
  tenant_id,
  manufacturer_id,
  tax_rate_id,
  equipment_id,
  name,
  length_mm,
  width_mm,
  thickness_mm,
  on_stock,
  active,
  price_net,
  machine_code,
  kerf_mm,
  waste_multi,
  usage_limit,
  rotatable
)
select
  t.id,
  m.id,
  tr.id,
  eq.id,
  'Fehér laminált 18',
  2800,
  2070,
  18,
  true,
  true,
  7000,
  'MAT01',
  3,
  1.20,
  0.65,
  true
from public.tenants t
join public.manufacturers m
  on m.tenant_id = t.id and lower(m.name) = 'blum' and m.deleted_at is null
join public.tax_rates tr
  on tr.tenant_id = t.id and tr.is_default = true and tr.deleted_at is null
join public.equipment eq
  on eq.tenant_id = t.id
  and lower(eq.name) = 'cnc'
  and eq.deleted_at is null
where t.slug = 'demo'
  and not exists (
    select 1
    from public.sheet_materials s
    where s.tenant_id = t.id
      and s.deleted_at is null
      and lower(s.name) = 'fehér laminált 18'
  );

-- Példa ügyfél
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
select
  t.id,
  'Minta Bútor Bt.',
  'info@mintabutor.hu',
  '+36 30 123 4567',
  'Minta Bútor Bt.',
  'Magyarország',
  'Budapest',
  '1117',
  'Budafoki út',
  '12'
from public.tenants t
where t.slug = 'demo'
  and not exists (
    select 1
    from public.customers c
    where c.tenant_id = t.id
      and c.deleted_at is null
      and lower(c.name) = 'minta bútor bt.'
  );

-- Opti vágási díj (nettó 300 Ft/m + default ÁFA)
insert into public.cutting_fees (
  tenant_id,
  fee_per_meter,
  tax_rate_id
)
select
  t.id,
  300,
  tr.id
from public.tenants t
join public.tax_rates tr
  on tr.tenant_id = t.id
  and tr.is_default = true
  and tr.deleted_at is null
where t.slug = 'demo'
  and not exists (
    select 1
    from public.cutting_fees cf
    where cf.tenant_id = t.id
      and cf.deleted_at is null
  );

-- Cégadatok profil (ha még nincs)
insert into public.tenant_companies (
  tenant_id,
  name,
  country,
  postal_code,
  city,
  address,
  phone_number,
  email,
  website
)
select
  t.id,
  t.name,
  'Magyarország',
  '6000',
  'Kecskemét',
  'Példa utca 1.',
  '+36 30 999 2800',
  'info@demo.hu',
  'https://demo.hu'
from public.tenants t
where t.slug = 'demo'
  and not exists (
    select 1
    from public.tenant_companies tc
    where tc.tenant_id = t.id
  );

-- Példa fizetési módok
insert into public.payment_methods (tenant_id, name, active)
select t.id, v.name, true
from public.tenants t
cross join (
  values
    ('Készpénz'),
    ('Utalás'),
    ('Bankkártya')
) as v(name)
where t.slug = 'demo'
  and not exists (
    select 1
    from public.payment_methods pm
    where pm.tenant_id = t.id
      and lower(pm.name) = lower(v.name)
      and pm.deleted_at is null
  );

-- Példa gyártógépek (műhely)
insert into public.production_machines (
  tenant_id,
  name,
  usage_limit_per_day,
  active
)
select t.id, v.name, v.usage_limit_per_day, true
from public.tenants t
cross join (
  values
    ('CNC 1', 100),
    ('CNC 2', 80),
    ('Kis rendelés', 40)
) as v(name, usage_limit_per_day)
where t.slug = 'demo'
  and not exists (
    select 1
    from public.production_machines pm
    where pm.tenant_id = t.id
      and lower(pm.name) = lower(v.name)
      and pm.deleted_at is null
  );

-- Oldaljogok: futtasd a 20260325_membership_page_access.sql migrációt.
-- Az backfilleli a meglévő membership-eket (owner/admin = teljes, tag = irodai).

-- Platform admin: futtasd a 20260326_platform_admin.sql-t.
-- A seed emailű user platform_admins-be kerül (admin@turinova.hu).
