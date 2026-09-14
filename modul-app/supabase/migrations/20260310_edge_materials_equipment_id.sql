-- modul-app: élzáró → berendezés (export)
-- Meglévő DB-kre, ahol az edge_materials tábla equipment_id nélkül jött létre.
-- Futtasd az edge_materials + equipment migrációk után.

alter table public.edge_materials
  add column if not exists equipment_id uuid references public.equipment (id);

-- Meglévő sorok: tenant első élő berendezése (ha van)
update public.edge_materials e
set equipment_id = sub.id
from (
  select distinct on (eq.tenant_id) eq.tenant_id, eq.id
  from public.equipment eq
  where eq.deleted_at is null
  order by eq.tenant_id, eq.name
) as sub
where e.tenant_id = sub.tenant_id
  and e.equipment_id is null;

create index if not exists edge_materials_equipment_id_idx
  on public.edge_materials (equipment_id)
  where deleted_at is null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'edge_materials'
      and column_name = 'equipment_id'
      and is_nullable = 'YES'
  ) and not exists (
    select 1 from public.edge_materials where equipment_id is null
  ) then
    alter table public.edge_materials
      alter column equipment_id set not null;
  end if;
end $$;

comment on column public.edge_materials.equipment_id is 'Export berendezés (equipment törzs)';
