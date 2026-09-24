-- POS: termék megjelenhet a pulti keresőben (katalógus vs pult)

alter table public.accessories
  add column if not exists sellable_pos boolean not null default true;

comment on column public.accessories.sellable_pos is
  'Ha true: megjelenik a POS/értékesítés typeaheadben. Katalógus / csak web: false.';

create index if not exists accessories_tenant_sellable_pos_idx
  on public.accessories (tenant_id, sellable_pos)
  where deleted_at is null and active = true;
