-- Beszerzési nettó + árrés szorzó (eladási price_net külön forrásigazság)

alter table public.sheet_materials
  add column if not exists purchase_price_net numeric(12, 0)
    check (purchase_price_net is null or purchase_price_net >= 0),
  add column if not exists margin_factor numeric(8, 4)
    check (margin_factor is null or (margin_factor > 0 and margin_factor <= 100));

comment on column public.sheet_materials.purchase_price_net is
  'Beszerzési nettó Ft/m²; opcionális. Eladási ár: price_net.';
comment on column public.sheet_materials.margin_factor is
  'Árrés szorzó (pl. 1.35); opcionális. Eladási ≈ purchase × factor.';

alter table public.linear_materials
  add column if not exists purchase_price_net numeric(12, 0)
    check (purchase_price_net is null or purchase_price_net >= 0),
  add column if not exists margin_factor numeric(8, 4)
    check (margin_factor is null or (margin_factor > 0 and margin_factor <= 100));

comment on column public.linear_materials.purchase_price_net is
  'Beszerzési nettó Ft/m; opcionális. Eladási ár: price_net.';
comment on column public.linear_materials.margin_factor is
  'Árrés szorzó (pl. 1.35); opcionális.';

alter table public.accessories
  add column if not exists purchase_price_net numeric(12, 0)
    check (purchase_price_net is null or purchase_price_net >= 0),
  add column if not exists margin_factor numeric(8, 4)
    check (margin_factor is null or (margin_factor > 0 and margin_factor <= 100));

comment on column public.accessories.purchase_price_net is
  'Beszerzési nettó Ft/egység; opcionális. Eladási ár: price_net.';
comment on column public.accessories.margin_factor is
  'Árrés szorzó (pl. 1.35); opcionális.';
