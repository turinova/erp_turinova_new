-- Szálas anyagok: nincs export (berendezés / gépkód)
alter table public.linear_materials
  drop column if exists equipment_id,
  drop column if exists machine_code;

drop index if exists public.linear_materials_equipment_id_idx;
