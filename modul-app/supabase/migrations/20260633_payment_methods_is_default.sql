-- Tenant alapértelmezett fizetési mód (selectek: megrendelés / befizetés / átadás).
-- Max 1 élő default / tenant — raktár is_default minta.

alter table public.payment_methods
  add column if not exists is_default boolean not null default false;

comment on column public.payment_methods.is_default is
  'Tenant alapértelmezett fizetési mód (UI selectek); max 1 élő / tenant.';

create unique index if not exists payment_methods_one_default_alive_uidx
  on public.payment_methods (tenant_id)
  where is_default = true and deleted_at is null;

-- Backfill: tenantonként 1 aktív default, ha még nincs.
-- Preferált: készpénz-nevű aktív; else első aktív név szerint.
with tenants_needing as (
  select pm.tenant_id
  from public.payment_methods pm
  where pm.deleted_at is null
    and pm.active = true
  group by pm.tenant_id
  having bool_or(pm.is_default) = false
),
ranked as (
  select
    pm.id,
    pm.tenant_id,
    row_number() over (
      partition by pm.tenant_id
      order by
        case
          when lower(pm.name) like '%készpénz%' then 0
          when lower(pm.name) like '%keszpenz%' then 0
          when lower(pm.name) like '%cash%' then 0
          when lower(trim(pm.name)) in ('kp', 'k.p.', 'k.p') then 0
          else 1
        end,
        lower(pm.name) asc
    ) as rn
  from public.payment_methods pm
  inner join tenants_needing t on t.tenant_id = pm.tenant_id
  where pm.deleted_at is null
    and pm.active = true
)
update public.payment_methods pm
set is_default = true,
    updated_at = now()
from ranked r
where pm.id = r.id
  and r.rn = 1;
