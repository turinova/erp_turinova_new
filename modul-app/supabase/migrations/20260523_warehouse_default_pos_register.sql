-- Új raktár → default pénztár (Főpénztár).
-- A 20260514 egyszeri seed csak a migráció idején létező WH-kra futott.

create or replace function public.seed_default_pos_register_for_warehouse()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.deleted_at is not null or new.is_active is not true then
    return new;
  end if;

  if exists (
    select 1
    from public.pos_registers r
    where r.warehouse_id = new.id
      and r.deleted_at is null
  ) then
    return new;
  end if;

  insert into public.pos_registers (
    tenant_id,
    warehouse_id,
    name,
    code,
    is_active,
    is_default
  )
  values (
    new.tenant_id,
    new.id,
    'Főpénztár',
    'K-' || left(replace(new.id::text, '-', ''), 8),
    true,
    true
  );

  return new;
end;
$$;

drop trigger if exists warehouses_seed_default_pos_register_trg on public.warehouses;
create trigger warehouses_seed_default_pos_register_trg
  after insert on public.warehouses
  for each row
  execute function public.seed_default_pos_register_for_warehouse();

comment on function public.seed_default_pos_register_for_warehouse() is
  'Új aktív raktárhoz egy default Főpénztár (POS).';

-- Backfill: meglévő aktív raktárak pénztár nélkül
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
where w.deleted_at is null
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
