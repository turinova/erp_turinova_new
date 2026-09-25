-- B2C / agent-ready webshop mezők az accessories törzsön (doc 38)

alter table public.accessories
  add column if not exists sellable_web boolean not null default false,
  add column if not exists web_slug text,
  add column if not exists web_title text,
  add column if not exists web_description_short text,
  add column if not exists web_description_long text,
  add column if not exists web_brand text,
  add column if not exists web_gtin text,
  add column if not exists web_mpn text,
  add column if not exists web_product_type text,
  add column if not exists web_google_category text,
  add column if not exists web_tags text[] not null default '{}',
  add column if not exists web_search_aliases text[] not null default '{}',
  add column if not exists web_color text,
  add column if not exists web_size text,
  add column if not exists web_material text,
  add column if not exists web_attributes jsonb not null default '{}'::jsonb,
  add column if not exists web_specs jsonb not null default '{}'::jsonb,
  add column if not exists web_gallery jsonb not null default '[]'::jsonb,
  add column if not exists web_faq jsonb not null default '[]'::jsonb,
  add column if not exists web_use_cases text[] not null default '{}',
  add column if not exists web_compatibility text[] not null default '{}',
  add column if not exists web_compare_at_price integer,
  add column if not exists shipping_weight_kg numeric(12, 3),
  add column if not exists shipping_length_cm numeric(12, 2),
  add column if not exists shipping_width_cm numeric(12, 2),
  add column if not exists shipping_height_cm numeric(12, 2),
  add column if not exists product_weight_kg numeric(12, 3),
  add column if not exists product_length_cm numeric(12, 2),
  add column if not exists product_width_cm numeric(12, 2),
  add column if not exists product_height_cm numeric(12, 2),
  add column if not exists web_group_id text;

comment on column public.accessories.sellable_web is
  'B2C webshop / feed / LLM channel. Független a sellable_pos-tól.';
comment on column public.accessories.web_slug is
  'Canonical PDP slug (/p/{slug}). Unique per tenant among alive rows.';
comment on column public.accessories.web_attributes is
  'LLM search filters: { "kulcs": "érték" }.';
comment on column public.accessories.web_specs is
  'Műszaki adatok detailshez: { "kulcs": "érték" }.';
comment on column public.accessories.web_gallery is
  'Extra kép URL-ek tömbje (JSON array of strings).';
comment on column public.accessories.web_faq is
  'Strukturált FAQ: [{ "q": "...", "a": "..." }].';

alter table public.accessories
  drop constraint if exists accessories_web_compare_at_price_nonneg;
alter table public.accessories
  add constraint accessories_web_compare_at_price_nonneg
  check (web_compare_at_price is null or web_compare_at_price >= 0);

alter table public.accessories
  drop constraint if exists accessories_web_slug_format;
alter table public.accessories
  add constraint accessories_web_slug_format
  check (
    web_slug is null
    or web_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  );

create unique index if not exists accessories_tenant_web_slug_alive_uidx
  on public.accessories (tenant_id, web_slug)
  where deleted_at is null and web_slug is not null;

create index if not exists accessories_tenant_sellable_web_idx
  on public.accessories (tenant_id, sellable_web)
  where deleted_at is null and active = true and sellable_web = true;
