-- Storefront PDP általános váz (doc 40 §3e): bármilyen termékkörre (élelmiszer, kozmetikum, vegyi áru…).
-- 1) accessories: nettó tartalom + mértékegység (kötelező egységár, 98/6/EK), összetevők, használat, videó
-- 2) tenant_webshop_settings: képarány (1:1 / 4:5), nettó ár mutatása B2B vevőknek

-- ---------------------------------------------------------------------------
-- 1) Termék
-- ---------------------------------------------------------------------------
alter table public.accessories
  add column if not exists web_net_quantity numeric(12, 3),
  add column if not exists web_net_unit text,
  add column if not exists web_ingredients text,
  add column if not exists web_usage text,
  add column if not exists web_video_url text;

alter table public.accessories
  drop constraint if exists accessories_web_net_content_chk;
alter table public.accessories
  add constraint accessories_web_net_content_chk check (
    (web_net_quantity is null or web_net_quantity > 0)
    and (web_net_unit is null or web_net_unit in ('g', 'kg', 'ml', 'l', 'db', 'm', 'm2'))
    and ((web_net_quantity is null) = (web_net_unit is null))
  );

comment on column public.accessories.web_net_quantity is
  'Nettó tartalom (pl. 400 ml → 400). Egységár: Ft/kg, Ft/l, Ft/m, Ft/m², Ft/db.';
comment on column public.accessories.web_net_unit is
  'g | kg | ml | l | db | m | m2 — a web_net_quantity mértékegysége.';
comment on column public.accessories.web_ingredients is
  'Összetevők / anyagösszetétel (élelmiszer, takarmány: allergének; kozmetikum: INCI).';
comment on column public.accessories.web_usage is
  'Használat, adagolás, ápolás.';
comment on column public.accessories.web_video_url is
  'YouTube / Vimeo / közvetlen MP4 link — a PDP-n kattintásra töltődik.';

-- ---------------------------------------------------------------------------
-- 2) Bolt beállítások
-- ---------------------------------------------------------------------------
alter table public.tenant_webshop_settings
  add column if not exists image_aspect text not null default 'square',
  add column if not exists show_net_price boolean not null default false;

alter table public.tenant_webshop_settings
  drop constraint if exists tenant_webshop_settings_image_aspect_chk;
alter table public.tenant_webshop_settings
  add constraint tenant_webshop_settings_image_aspect_chk
  check (image_aspect in ('square', 'portrait'));

comment on column public.tenant_webshop_settings.image_aspect is
  'Termékképek aránya a boltban: square (1:1) vagy portrait (4:5, divat / kozmetikum).';
comment on column public.tenant_webshop_settings.show_net_price is
  'B2B: a bruttó ár alatt a nettó ár is látszik.';
