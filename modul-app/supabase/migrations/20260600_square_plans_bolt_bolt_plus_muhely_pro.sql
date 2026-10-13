-- Square-szemléletű csomagok: Bolt / Bolt+ / Műhely / Pro
-- Forrás: docs/33-packages-and-addons.md, docs/46-csomagok-funkcio-matrix.md
--
-- 1) alap → bolt (rename)
-- 2) bolt_plus, muhely, pro planek + feature másolat + bundel feature-ök
-- 3) bundelt add-on listaárak 0 (pda_pos marad à la carte áron Műhelyhez)
-- 4) tenant backfill plan kulcsra + bundel tenant_addons + rematerialize entitlements

-- ---------------------------------------------------------------------------
-- 1. Rename Alap → Bolt
-- ---------------------------------------------------------------------------
update public.product_plans
set
  key = 'bolt',
  name = 'Bolt',
  description = 'Pult + készlet + beszerzés + ügyfélrendelés + számla. Square Plus mag.',
  price_monthly_huf = 39990,
  currency = 'HUF',
  updated_at = now()
where key = 'alap';

-- Idempotens: ha már bolt
update public.product_plans
set
  name = 'Bolt',
  description = coalesce(
    nullif(trim(description), ''),
    'Pult + készlet + beszerzés + ügyfélrendelés + számla. Square Plus mag.'
  ),
  price_monthly_huf = 39990,
  currency = 'HUF',
  is_default = true,
  updated_at = now()
where key = 'bolt';

-- Más plan ne legyen default
update public.product_plans
set is_default = false, updated_at = now()
where key <> 'bolt' and is_default = true;

update public.product_plans
set is_default = true, updated_at = now()
where key = 'bolt';

-- ---------------------------------------------------------------------------
-- 2. Új planek
-- ---------------------------------------------------------------------------
insert into public.product_plans (
  key, name, description, is_default, price_monthly_huf, currency
)
values
  (
    'bolt_plus',
    'Bolt+',
    'Bolt + PDA + jelenlét + belépőszámláló (szoftver). Hardver egyszeri.',
    false,
    59900,
    'HUF'
  ),
  (
    'muhely',
    'Műhely',
    'Bolt + lapszabászat (Opti, partner, átvételi blokk). PDA à la carte.',
    false,
    49990,
    'HUF'
  ),
  (
    'pro',
    'Pro',
    'Bolt+ + prioritás support. Webshop※ külön / jégelt — ne auto-enable.',
    false,
    94900,
    'HUF'
  )
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description,
  price_monthly_huf = excluded.price_monthly_huf,
  currency = 'HUF',
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 3. Plan feature-ök: bolt másolat → bolt_plus / muhely / pro
-- ---------------------------------------------------------------------------
insert into public.product_plan_features (plan_id, feature_key)
select tgt.id, pf.feature_key
from public.product_plans src
join public.product_plan_features pf on pf.plan_id = src.id
cross join public.product_plans tgt
where src.key = 'bolt'
  and tgt.key in ('bolt_plus', 'muhely', 'pro')
on conflict do nothing;

-- Bolt+ / Pro: PDA + jelenlét + footcounter feature-ök (addon katalógusból)
insert into public.product_plan_features (plan_id, feature_key)
select p.id, paf.feature_key
from public.product_plans p
cross join public.product_addons a
join public.product_addon_features paf on paf.addon_id = a.id
where p.key in ('bolt_plus', 'pro')
  and a.key in ('pda_pos', 'jelenlet', 'footcounter')
on conflict do nothing;

-- Műhely: lapszabászat + partner + SMS feature-ök
insert into public.product_plan_features (plan_id, feature_key)
select p.id, paf.feature_key
from public.product_plans p
cross join public.product_addons a
join public.product_addon_features paf on paf.addon_id = a.id
where p.key = 'muhely'
  and a.key in ('lapszabaszat', 'partner_orders', 'quote_ready_sms')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 4. Add-on listaárak (értékesítési lista)
--    Bundel: 0 Ft · PDA à la carte Műhelyhez marad 7900 · webshop 12900 (gate)
-- ---------------------------------------------------------------------------
update public.product_addons
set
  price_monthly_huf = 0,
  description = coalesce(description, '') || ' · Bundel: Bolt+ / Pro (listaár 0).',
  updated_at = now()
where key in ('jelenlet', 'footcounter')
  and price_monthly_huf <> 0;

update public.product_addons
set
  price_monthly_huf = 0,
  description = 'Opti stack — Műhely plan része (listaár 0). À la carte csak legacy.',
  updated_at = now()
where key = 'lapszabaszat';

update public.product_addons
set
  price_monthly_huf = 7900,
  description = 'PDA POS. Bolt+/Pro bundel (billing skip ha planben). Műhelyen à la carte 7900.',
  updated_at = now()
where key = 'pda_pos';

update public.product_addons
set
  price_monthly_huf = 0,
  updated_at = now()
where key in ('partner_orders', 'quote_ready_sms');

-- ---------------------------------------------------------------------------
-- 5. Tenant backfill plan kulcs
--    bolt_plus: pda ∧ jelenlet ∧ foot (lapszab nélkül VAGY lapszabbal is bolt_plus
--               ha mindhárom üzem megvan — vegyes: muhely + extras a TS sync kezeli)
--    muhely: lapszab ON és NEM (pda∧jelenlet∧foot)
--    egyéb: bolt
-- ---------------------------------------------------------------------------
with addon_flags as (
  select
    t.id as tenant_id,
    t.plan_id,
    exists (
      select 1
      from public.tenant_addons ta
      join public.product_addons a on a.id = ta.addon_id
      where ta.tenant_id = t.id and a.key = 'lapszabaszat'
    ) as has_lapszab,
    exists (
      select 1
      from public.tenant_addons ta
      join public.product_addons a on a.id = ta.addon_id
      where ta.tenant_id = t.id and a.key = 'pda_pos'
    ) as has_pda,
    exists (
      select 1
      from public.tenant_addons ta
      join public.product_addons a on a.id = ta.addon_id
      where ta.tenant_id = t.id and a.key = 'jelenlet'
    ) as has_jelenlet,
    exists (
      select 1
      from public.tenant_addons ta
      join public.product_addons a on a.id = ta.addon_id
      where ta.tenant_id = t.id and a.key = 'footcounter'
    ) as has_foot
  from public.tenants t
),
target as (
  select
    tenant_id,
    case
      when has_pda and has_jelenlet and has_foot and not has_lapszab
        then 'bolt_plus'
      when has_pda and has_jelenlet and has_foot and has_lapszab
        then 'bolt_plus' -- vegyes: üzem plan + lapszab à la carte marad
      when has_lapszab
        then 'muhely'
      else 'bolt'
    end as plan_key,
    case
      when has_pda and has_jelenlet and has_foot and has_lapszab
        then 'package_migrate:review mixed bolt_plus+lapszab'
      when has_lapszab and (has_pda or has_jelenlet or has_foot)
           and not (has_pda and has_jelenlet and has_foot)
        then 'package_migrate:review muhely+partial_uzem'
      else null
    end as note_tag
  from addon_flags
)
update public.tenants t
set
  plan_id = p.id,
  billing_notes = case
    when target.note_tag is null then t.billing_notes
    when t.billing_notes is null or trim(t.billing_notes) = '' then target.note_tag
    when position(target.note_tag in t.billing_notes) > 0 then t.billing_notes
    else t.billing_notes || E'\n' || target.note_tag
  end,
  updated_at = now()
from target
join public.product_plans p on p.key = target.plan_key
where t.id = target.tenant_id
  and (
    t.plan_id is distinct from p.id
    or target.note_tag is not null
  );

-- ---------------------------------------------------------------------------
-- 6. Bundel tenant_addons a plan szerint
-- ---------------------------------------------------------------------------

-- Bolt+: pda + jelenlet + foot
insert into public.tenant_addons (tenant_id, addon_id, enabled_at)
select t.id, a.id, now()
from public.tenants t
join public.product_plans p on p.id = t.plan_id
cross join public.product_addons a
where p.key in ('bolt_plus', 'pro')
  and a.key in ('pda_pos', 'jelenlet', 'footcounter')
on conflict (tenant_id, addon_id) do nothing;

-- Műhely: lapszab + partner + sms
insert into public.tenant_addons (tenant_id, addon_id, enabled_at)
select t.id, a.id, now()
from public.tenants t
join public.product_plans p on p.id = t.plan_id
cross join public.product_addons a
where p.key = 'muhely'
  and a.key in ('lapszabaszat', 'partner_orders', 'quote_ready_sms')
on conflict (tenant_id, addon_id) do nothing;

-- Bolt: ne erőltessük a lapszab / üzem lekapcsolását SQL-ben
-- (production tenantoknál a platform setTenantPlan / apply kezeli).
-- Régi „mindenki kapott lapszabot” backfill → muhely-re került fent.

-- ---------------------------------------------------------------------------
-- 7. Rematerialize entitlements (plan ∪ addons; overrides megmaradnak külön)
--    Egyszerűsített: törlés + újraépítés plan+addon feature-ökből.
--    Override-okat a app materialize kezeli — itt union + meglévő enabled overrides.
-- ---------------------------------------------------------------------------
delete from public.tenant_entitlements te
using public.tenants t
where te.tenant_id = t.id;

insert into public.tenant_entitlements (tenant_id, feature_key)
select t.id, pf.feature_key
from public.tenants t
join public.product_plan_features pf on pf.plan_id = t.plan_id
on conflict do nothing;

insert into public.tenant_entitlements (tenant_id, feature_key)
select ta.tenant_id, paf.feature_key
from public.tenant_addons ta
join public.product_addon_features paf on paf.addon_id = ta.addon_id
on conflict do nothing;

-- Enabled overrides
insert into public.tenant_entitlements (tenant_id, feature_key)
select o.tenant_id, o.feature_key
from public.tenant_feature_overrides o
where o.enabled = true
on conflict do nothing;

-- Disabled overrides
delete from public.tenant_entitlements te
using public.tenant_feature_overrides o
where te.tenant_id = o.tenant_id
  and te.feature_key = o.feature_key
  and o.enabled = false;

-- Mindig /home
insert into public.tenant_entitlements (tenant_id, feature_key)
select t.id, '/home'
from public.tenants t
on conflict do nothing;

comment on table public.product_plans is
  'Plans: bolt / bolt_plus / muhely / pro (Square packaging). Default: bolt.';
