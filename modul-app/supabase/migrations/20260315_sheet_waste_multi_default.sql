-- modul-app: hulladékszorzó default 1.20 (main Opti parity a captionhez / új anyagokhoz)
-- Meglévő anyagok: csak ahol még 1.00 — frissíti 1.20-ra.

alter table public.sheet_materials
  alter column waste_multi set default 1.20;

update public.sheet_materials
set waste_multi = 1.20,
    updated_at = now()
where deleted_at is null
  and waste_multi = 1.00;
