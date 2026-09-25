-- Storefront katalógus és AI-kész termékadat (doc 40):
-- 1) accessories: web_identifier_exists (GTIN/MPN hiány kifejezett jelölése), web_image_alts
-- 2) tenant_webshop_settings.allow_ai_training (GPTBot / Google-Extended)
-- 3) accessory_related: „Kell hozzá” kapcsolat
-- 4) storefront_search RPC (ékezet-független, kulcsadat-értékekre is)
-- 5) Takarítás: automatikus sablon GYIK és „… szereléséhez / cseréjéhez” felhasználás

create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------------
-- 1) Termék mezők
-- ---------------------------------------------------------------------------
alter table public.accessories
  add column if not exists web_identifier_exists boolean not null default true,
  add column if not exists web_image_alts jsonb not null default '{}'::jsonb;

comment on column public.accessories.web_identifier_exists is
  'false = a terméknek nincs GTIN-je és gyártói cikkszáma (feed identifier_exists=no).';
comment on column public.accessories.web_image_alts is
  'Kép URL → alt szöveg (PDP, feed). Hiányzó kulcs = a termék címe.';

-- ---------------------------------------------------------------------------
-- 2) AI tréning botok
-- ---------------------------------------------------------------------------
alter table public.tenant_webshop_settings
  add column if not exists allow_ai_training boolean not null default false;

-- ---------------------------------------------------------------------------
-- 3) Kapcsolódó termékek
-- ---------------------------------------------------------------------------
create table if not exists public.accessory_related (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  accessory_id uuid not null references public.accessories (id) on delete cascade,
  related_id uuid not null references public.accessories (id) on delete cascade,
  kind text not null default 'required' check (kind in ('required')),
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  primary key (accessory_id, related_id),
  constraint accessory_related_not_self check (accessory_id <> related_id)
);

create index if not exists accessory_related_tenant_idx
  on public.accessory_related (tenant_id, accessory_id);

alter table public.accessory_related enable row level security;

drop policy if exists accessory_related_select on public.accessory_related;
drop policy if exists accessory_related_write on public.accessory_related;

create policy accessory_related_select
  on public.accessory_related for select to authenticated
  using (public.is_tenant_member(tenant_id));

create policy accessory_related_write
  on public.accessory_related for all to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

grant select, insert, update, delete on public.accessory_related to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Kereső
-- ---------------------------------------------------------------------------
create or replace function public.storefront_num_text(p numeric)
returns text
language sql
immutable
as $$
  select case
    when p is null then null
    when p = trunc(p) then trunc(p)::bigint::text
    else rtrim(p::text, '0')
  end;
$$;

-- Minden szó (token) szerepeljen: cím, név, cikkszám, EAN, márka, gyártó, szín,
-- anyag, kereső szinonimák, kategória, kulcsadat értékek („160 mm”, „fekete”).
create or replace function public.storefront_search(
  p_tenant_id uuid,
  p_q text,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (accessory_id uuid, total_count bigint)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with q as (
    select array_remove(
      regexp_split_to_array(
        regexp_replace(
          regexp_replace(
            regexp_replace(lower(unaccent(coalesce(p_q, ''))), '(\d),(\d)', '\1.\2', 'g'),
            '(\d)([a-z])', '\1 \2', 'g'
          ),
          '[^a-z0-9.]+', ' ', 'g'
        ),
        ' '
      ),
      ''
    ) as toks
  ),
  docs as (
    select
      a.id,
      coalesce(nullif(btrim(a.web_title), ''), a.name) as title,
      lower(unaccent(concat_ws(' ',
        a.web_title, a.name, a.sku, a.barcode, a.web_gtin, a.web_mpn, a.web_brand,
        m.name, a.web_color, a.web_size, a.web_material,
        array_to_string(a.web_search_aliases, ' '),
        c.name,
        (
          select string_agg(
            public.storefront_num_text(i.value_num) || ' ' || coalesce(pa.unit, ''),
            ' '
          )
          from public.accessory_attribute_inputs i
          join public.product_attributes pa on pa.id = i.attribute_id
          where i.accessory_id = a.id and i.value_num is not null
        ),
        (
          select string_agg(av.label, ' ')
          from public.accessory_attribute_values aav
          join public.attribute_values av on av.id = aav.attribute_value_id
          where aav.accessory_id = a.id and av.deleted_at is null
        )
      ))) as doc
    from public.accessories a
    left join public.manufacturers m on m.id = a.manufacturer_id
    left join public.web_categories c on c.id = a.web_category_id and c.deleted_at is null
    where a.tenant_id = p_tenant_id
      and a.sellable_web
      and a.active
      and a.deleted_at is null
      and a.web_slug is not null
  ),
  hits as (
    select d.id, d.title
    from docs d, q
    where cardinality(q.toks) > 0
      and not exists (
        select 1 from unnest(q.toks) t where position(t in d.doc) = 0
      )
  )
  select h.id, count(*) over ()
  from hits h, q
  order by
    (lower(unaccent(h.title)) like q.toks[1] || '%') desc,
    similarity(lower(unaccent(h.title)), array_to_string(q.toks, ' ')) desc,
    h.title
  limit greatest(1, least(coalesce(p_limit, 25), 50))
  offset greatest(0, coalesce(p_offset, 0));
$$;

revoke all on function public.storefront_search(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.storefront_search(uuid, text, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- 5) Automatikus sablon-tartalom takarítása
-- Csak a szó szerint egyező sablonválaszokat és az általános felhasználást törli.
-- ---------------------------------------------------------------------------
update public.accessories a
set web_faq = coalesce((
  select jsonb_agg(e)
  from jsonb_array_elements(a.web_faq) e
  where e ->> 'a' not in (
    'Általában a csomagban lévő vagy 3,5×16 mm-es forgácslapcsavar megfelelő. A pontos méret a termék adatlapján / leírásában szerepel.',
    'A legtöbb bútorzsanér balra és jobbra is szerelhető; a nyílásirány a szereléskor állítható.',
    'Nézd a termék műszaki adatainál a furattávolságot (pl. 96 / 128 / 160 mm). Ha nincs megadva, a leírásban szerepel.',
    'A legtöbb fogantyúhoz M4-es csavar kell; a hossz a bútorajtó vastagságától függ.',
    'A termék nevében / leírásában szerepel. Teljes kihúzásnál a fiók teljesen kihúzható.',
    'A teherbírás a műszaki adatoknál vagy a leírásban van megadva kg-ban.',
    'Ellenőrizd a méreteket és a furatkiosztást a leírásban. Kérdés esetén keresd a bolt elérhetőségét.'
  )
), '[]'::jsonb)
where jsonb_typeof(a.web_faq) = 'array'
  and jsonb_array_length(a.web_faq) > 0;

update public.accessories a
set web_use_cases = array(
  select u from unnest(a.web_use_cases) u
  where u not like '% szereléséhez / cseréjéhez'
)
where exists (
  select 1 from unnest(a.web_use_cases) u
  where u like '% szereléséhez / cseréjéhez'
);
