-- modul-app: equipment export format (cutting-list Excel plugin key)
-- V1: only 'korpus' (main-app Korpus cutting list). Extend check + registry later.

alter table public.equipment
  add column if not exists export_format text not null default 'korpus';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'equipment_export_format_check'
  ) then
    alter table public.equipment
      add constraint equipment_export_format_check
      check (export_format in ('korpus'));
  end if;
end $$;

comment on column public.equipment.export_format is
  'Cutting-list Excel formátum kulcs (registry). V1: korpus.';
