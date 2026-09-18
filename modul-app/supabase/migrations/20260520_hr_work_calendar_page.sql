-- Munkarend / ünnepek oldal + éves HU seed (national + áthelyezett)

-- ---------------------------------------------------------------------------
-- 1) Page feature
-- ---------------------------------------------------------------------------
insert into public.product_features (key, label, category, page_key, sort_order, active)
values (
  '/jelenlet/naptar',
  'Munkarend / ünnepek',
  'Jelenlét',
  '/jelenlet/naptar',
  41,
  true
)
on conflict (key) do update
set
  label = excluded.label,
  category = excluded.category,
  page_key = excluded.page_key,
  sort_order = excluded.sort_order,
  active = true;

insert into public.product_addon_features (addon_id, feature_key)
select a.id, '/jelenlet/naptar'
from public.product_addons a
where a.key = 'jelenlet'
  and exists (
    select 1 from public.product_features f where f.key = '/jelenlet/naptar'
  )
on conflict do nothing;

insert into public.tenant_entitlements (tenant_id, feature_key)
select ta.tenant_id, '/jelenlet/naptar'
from public.tenant_addons ta
join public.product_addons a on a.id = ta.addon_id and a.key = 'jelenlet'
on conflict do nothing;

insert into public.tenant_membership_page_access (
  tenant_id, membership_id, page_key, can_access
)
select m.tenant_id, m.id, '/jelenlet/naptar', true
from public.tenant_memberships m
join public.tenant_addons ta on ta.tenant_id = m.tenant_id
join public.product_addons a on a.id = ta.addon_id and a.key = 'jelenlet'
on conflict (membership_id, page_key) do update
set can_access = true, updated_at = now();

-- ---------------------------------------------------------------------------
-- 2) Seed by year (nemzeti + áthelyezett; meglévő napot nem ír felül)
-- Forrás: HU munkaszüneti / áthelyezett napok (2026–2027); UI-ból is bővíthető.
-- ---------------------------------------------------------------------------
create or replace function public.seed_hr_hu_holidays_for_year(
  p_tenant_id uuid,
  p_year integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer := 0;
begin
  if p_year = 2026 then
    insert into public.hr_work_calendar (tenant_id, work_date, day_type, name)
    values
      (p_tenant_id, '2026-01-01', 'national', 'Újév'),
      (p_tenant_id, '2026-03-15', 'national', 'Nemzeti ünnep'),
      (p_tenant_id, '2026-04-06', 'national', 'Húsvét hétfő'),
      (p_tenant_id, '2026-05-01', 'national', 'A munka ünnepe'),
      (p_tenant_id, '2026-05-25', 'national', 'Pünkösd hétfő'),
      (p_tenant_id, '2026-08-20', 'national', 'Az államalapítás ünnepe'),
      (p_tenant_id, '2026-08-21', 'relocated_rest', 'Áthelyezett pihenőnap'),
      (p_tenant_id, '2026-08-22', 'relocated_work', 'Áthelyezett munkanap'),
      (p_tenant_id, '2026-10-23', 'national', 'Nemzeti ünnep'),
      (p_tenant_id, '2026-11-01', 'national', 'Mindenszentek'),
      (p_tenant_id, '2026-12-12', 'relocated_work', 'Áthelyezett munkanap'),
      (p_tenant_id, '2026-12-24', 'relocated_rest', 'Áthelyezett pihenőnap'),
      (p_tenant_id, '2026-12-25', 'national', 'Karácsony'),
      (p_tenant_id, '2026-12-26', 'national', 'Karácsony')
    on conflict (tenant_id, work_date) do nothing;
  elsif p_year = 2027 then
    insert into public.hr_work_calendar (tenant_id, work_date, day_type, name)
    values
      (p_tenant_id, '2027-01-01', 'national', 'Újév'),
      (p_tenant_id, '2027-03-15', 'national', 'Nemzeti ünnep'),
      (p_tenant_id, '2027-03-29', 'national', 'Húsvét hétfő'),
      (p_tenant_id, '2027-05-01', 'national', 'A munka ünnepe'),
      (p_tenant_id, '2027-05-17', 'national', 'Pünkösd hétfő'),
      (p_tenant_id, '2027-08-20', 'national', 'Az államalapítás ünnepe'),
      (p_tenant_id, '2027-10-23', 'national', 'Nemzeti ünnep'),
      (p_tenant_id, '2027-11-01', 'national', 'Mindenszentek'),
      (p_tenant_id, '2027-12-25', 'national', 'Karácsony'),
      (p_tenant_id, '2027-12-26', 'national', 'Karácsony')
    on conflict (tenant_id, work_date) do nothing;
  else
    return 0;
  end if;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

-- Backward compatible: seed 2026 + 2027
create or replace function public.seed_hr_hu_holidays_for_tenant(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_hr_hu_holidays_for_year(p_tenant_id, 2026);
  perform public.seed_hr_hu_holidays_for_year(p_tenant_id, 2027);
end;
$$;

-- Backfill áthelyezett / hiányzó 2026–27 napok meglévő tenantokra
select public.seed_hr_hu_holidays_for_tenant(t.id)
from public.tenants t;

grant execute on function public.seed_hr_hu_holidays_for_year(uuid, integer) to authenticated;
grant execute on function public.seed_hr_hu_holidays_for_tenant(uuid) to authenticated;
