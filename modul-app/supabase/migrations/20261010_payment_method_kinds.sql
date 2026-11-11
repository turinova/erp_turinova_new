-- Fix (rendszer) fizetési módok: kind oszlop, partner láthatóság, nincs létrehozás / törlés.
-- Tenantonként 5 sor: Készpénz, Bankkártya, Átutalás, SZÉP kártya, Utánvét.
-- A név fix, mert több SQL függvény és a kliens név alapján dönt (pl. '%készpénz%').
-- Docs: 20-partner-portal.md

alter table public.payment_methods
  add column if not exists kind text,
  add column if not exists partner_visible boolean not null default true;

alter table public.payment_methods
  drop constraint if exists payment_methods_kind_check;
alter table public.payment_methods
  add constraint payment_methods_kind_check
  check (kind is null or kind in ('cash', 'card', 'transfer', 'szep_card', 'cod'));

comment on column public.payment_methods.kind is
  'Rendszer fizetési mód fajta. null = régi, besorolhatatlan sor (csak inaktiválható).';
comment on column public.payment_methods.partner_visible is
  'A partner portál beküldésnél választható-e.';

create or replace function public.payment_method_kind_from_name(p_name text)
returns text
language sql
immutable
as $$
  select case
    when n like '%szép%' or n like '%szep%' then 'szep_card'
    when n like '%készpénz%' or n like '%keszpenz%' or n like '%cash%'
      or n in ('kp', 'k.p.', 'k.p') then 'cash'
    when n like '%utánvét%' or n like '%utanvet%' then 'cod'
    when n like '%kártya%' or n like '%kartya%' or n like '%card%' then 'card'
    when n like '%utal%' or n like '%transfer%' or n like '%wire%'
      or n like '%banki%' or n = 'bank' then 'transfer'
    else null
  end
  from (select lower(trim(coalesce(p_name, ''))) as n) s;
$$;

create or replace function public.payment_method_kind_label(p_kind text)
returns text
language sql
immutable
as $$
  select case p_kind
    when 'cash' then 'Készpénz'
    when 'card' then 'Bankkártya'
    when 'transfer' then 'Átutalás'
    when 'szep_card' then 'SZÉP kártya'
    when 'cod' then 'Utánvét'
    else null
  end;
$$;

-- Backfill: fajtánként az első élő sor kapja a kind-ot (default > aktív > régebbi).
with ranked as (
  select
    pm.id,
    public.payment_method_kind_from_name(pm.name) as k,
    row_number() over (
      partition by pm.tenant_id, public.payment_method_kind_from_name(pm.name)
      order by pm.is_default desc, pm.active desc, pm.created_at asc
    ) as rn
  from public.payment_methods pm
  where pm.deleted_at is null
    and pm.kind is null
)
update public.payment_methods pm
set kind = r.k
from ranked r
where pm.id = r.id
  and r.k is not null
  and r.rn = 1
  and not exists (
    select 1 from public.payment_methods o
    where o.tenant_id = pm.tenant_id
      and o.deleted_at is null
      and o.kind = r.k
  );

create unique index if not exists payment_methods_tenant_kind_alive_uidx
  on public.payment_methods (tenant_id, kind)
  where deleted_at is null and kind is not null;

-- Egységes név (pl. „Utalás” → „Átutalás”), ha nem ütközik másik élő sorral.
update public.payment_methods pm
set name = public.payment_method_kind_label(pm.kind),
    updated_at = now()
where pm.deleted_at is null
  and pm.kind is not null
  and pm.name <> public.payment_method_kind_label(pm.kind)
  and not exists (
    select 1 from public.payment_methods o
    where o.tenant_id = pm.tenant_id
      and o.deleted_at is null
      and o.id <> pm.id
      and lower(o.name) = lower(public.payment_method_kind_label(pm.kind))
  );

-- Hiányzó rendszer-sorok meglévő cégeknek: inaktívan, hogy a selectek ne változzanak.
create or replace function public.seed_system_payment_methods(
  p_tenant_id uuid,
  p_activate_basic boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.payment_methods (
    tenant_id, name, kind, active, partner_visible, is_default
  )
  select
    p_tenant_id,
    public.payment_method_kind_label(v.kind),
    v.kind,
    p_activate_basic and v.basic,
    v.basic,
    false
  from (
    values
      ('cash', true, 1),
      ('card', true, 2),
      ('transfer', true, 3),
      ('szep_card', false, 4),
      ('cod', false, 5)
  ) as v(kind, basic, ord)
  where not exists (
    select 1 from public.payment_methods o
    where o.tenant_id = p_tenant_id
      and o.deleted_at is null
      and (
        o.kind = v.kind
        or lower(o.name) = lower(public.payment_method_kind_label(v.kind))
      )
  )
  order by v.ord;

  -- Mindig legyen 1 aktív alapértelmezett (készpénz előnyben).
  if not exists (
    select 1 from public.payment_methods
    where tenant_id = p_tenant_id
      and deleted_at is null
      and is_default = true
  ) then
    update public.payment_methods
    set is_default = true,
        active = true,
        updated_at = now()
    where id = (
      select id from public.payment_methods
      where tenant_id = p_tenant_id
        and deleted_at is null
        and kind is not null
      order by (kind = 'cash') desc, active desc, created_at asc
      limit 1
    );
  end if;
end;
$$;

revoke all on function public.seed_system_payment_methods(uuid, boolean) from public;
revoke all on function public.seed_system_payment_methods(uuid, boolean) from authenticated;
grant execute on function public.seed_system_payment_methods(uuid, boolean) to service_role;

do $$
declare
  t record;
begin
  for t in select id from public.tenants loop
    perform public.seed_system_payment_methods(
      t.id,
      not exists (
        select 1 from public.payment_methods pm
        where pm.tenant_id = t.id and pm.deleted_at is null
      )
    );
  end loop;
end;
$$;

-- Új cég: azonnal megkapja az 5 rendszer-sort (KP / kártya / átutalás aktív).
create or replace function public.tenants_seed_payment_methods()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_system_payment_methods(new.id, true);
  return new;
end;
$$;

drop trigger if exists tenants_seed_payment_methods_trg on public.tenants;
create trigger tenants_seed_payment_methods_trg
  after insert on public.tenants
  for each row
  execute function public.tenants_seed_payment_methods();

-- Service role beszúrás (pl. demo seed) kind nélkül: név alapján kapja.
create or replace function public.payment_methods_before_insert()
returns trigger
language plpgsql
as $$
begin
  if new.kind is null then
    new.kind := public.payment_method_kind_from_name(new.name);
    if new.kind is not null and exists (
      select 1 from public.payment_methods o
      where o.tenant_id = new.tenant_id
        and o.deleted_at is null
        and o.kind = new.kind
    ) then
      new.kind := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists payment_methods_before_insert_trg on public.payment_methods;
create trigger payment_methods_before_insert_trg
  before insert on public.payment_methods
  for each row
  execute function public.payment_methods_before_insert();

-- Felhasználó (authenticated) nem nevezhet át, nem válthat fajtát, nem törölhet,
-- és régi (kind nélküli) sort nem aktiválhat újra.
create or replace function public.payment_methods_guard_update()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') <> 'authenticated' then
    return new;
  end if;
  if new.name is distinct from old.name then
    raise exception 'payment_methods_system_name_locked';
  end if;
  if new.kind is distinct from old.kind then
    raise exception 'payment_methods_system_kind_locked';
  end if;
  if new.deleted_at is distinct from old.deleted_at then
    raise exception 'payment_methods_delete_forbidden';
  end if;
  if old.kind is null and new.active and not old.active then
    raise exception 'payment_methods_legacy_reactivate_forbidden';
  end if;
  return new;
end;
$$;

drop trigger if exists payment_methods_guard_update_trg on public.payment_methods;
create trigger payment_methods_guard_update_trg
  before update on public.payment_methods
  for each row
  execute function public.payment_methods_guard_update();

drop policy if exists payment_methods_insert_writer on public.payment_methods;
drop policy if exists payment_methods_delete_writer on public.payment_methods;

drop policy if exists payment_methods_select_partner_catalog
  on public.payment_methods;
create policy payment_methods_select_partner_catalog
  on public.payment_methods
  for select
  to authenticated
  using (
    deleted_at is null
    and active = true
    and partner_visible = true
    and public.partner_can_read_tenant_catalog(tenant_id)
  );
