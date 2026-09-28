-- modul-app: webshop kereső v2 (doc 42)
-- Előfeltétel: 20260548 (accessory_web), 20260550 (storefront_order_counts), unaccent + pg_trgm.
--
-- • storefront_search_index: termékenként előre összerakott, súlyozott dokumentum
--   (A cím · B kategória/márka/alias · C jellemzők · D leírás) — nem kérésenként épül.
-- • Frissítés lustán: triggerek sorba teszik a változott termékeket, a következő
--   keresés (advisory lockkal) újraindexeli őket. Kategória/gyártó/jellemző átnevezés
--   → teljes újraépítés jelző.
-- • storefront_search_terms: szókincs az elgépelés-javításhoz.
-- • storefront_search_synonyms: globális (tenant_id null) + saját szinonimák.
-- • storefront_search_log: keresések és kattintások (nulla találat riport, tanulás).

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- 1) Magyar, ékezetfüggetlen szövegkereső konfiguráció
-- ---------------------------------------------------------------------------
do $$
declare
  v_dict text;
begin
  select quote_ident(n.nspname) || '.unaccent'
    into v_dict
  from pg_ts_dict d
  join pg_namespace n on n.oid = d.dictnamespace
  where d.dictname = 'unaccent'
  limit 1;
  if v_dict is null then
    raise exception 'unaccent text search dictionary not found';
  end if;
  if not exists (
    select 1 from pg_ts_config c
    where c.cfgname = 'hu_search' and c.cfgnamespace = 'public'::regnamespace
  ) then
    create text search configuration public.hu_search (copy = pg_catalog.hungarian);
  end if;
  execute format(
    'alter text search configuration public.hu_search
       alter mapping for hword, hword_part, word, asciiword, asciihword, hword_asciipart
       with %s, hungarian_stem',
    v_dict
  );
end $$;

-- Kereső normalizálás (a TS oldali normSearch() tükre):
-- kisbetű, ékezet nélkül, 12,5 → 12.5, szám/betű határ szétválasztva, csak [a-z0-9.].
create or replace function public.storefront_norm(p text)
returns text
language sql
stable
set search_path = public, extensions
as $$
  select btrim(regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(lower(unaccent(coalesce(p, ''))), '(\d),(\d)', '\1.\2', 'g'),
          '(\d)([a-z])', '\1 \2', 'g'
        ),
        '([a-z])(\d)', '\1 \2', 'g'
      ),
      '(?<![0-9])\.|\.(?![0-9])|[^a-z0-9.]+', ' ', 'g'
    ),
    '\s+', ' ', 'g'
  ));
$$;

-- Cikkszám / EAN összevetéshez: csak betű+szám.
create or replace function public.storefront_code(p text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(lower(coalesce(p, '')), '[^a-z0-9]', '', 'g'), '');
$$;

-- ---------------------------------------------------------------------------
-- 2) Táblák
-- ---------------------------------------------------------------------------
create table if not exists public.storefront_search_index (
  accessory_id uuid primary key references public.accessories (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  category_id uuid,
  group_key text not null,
  title text not null,
  title_norm text not null,
  doc_norm text not null,
  vocab text not null,
  codes text[] not null default '{}',
  tsv tsvector not null,
  orders integer not null default 0,
  indexed_at timestamptz not null default now()
);

create index if not exists storefront_search_index_tenant_idx
  on public.storefront_search_index (tenant_id);
create index if not exists storefront_search_index_codes_idx
  on public.storefront_search_index using gin (codes);
create index if not exists storefront_search_index_tsv_idx
  on public.storefront_search_index using gin (tsv);

create table if not exists public.storefront_search_queue (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  accessory_id uuid not null,
  queued_at timestamptz not null default now(),
  primary key (tenant_id, accessory_id)
);

create table if not exists public.storefront_search_state (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  dirty_all boolean not null default true,
  built_at timestamptz
);

create table if not exists public.storefront_search_terms (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  term text not null,
  surface text not null,
  freq integer not null default 1,
  primary key (tenant_id, term)
);

create table if not exists public.storefront_search_synonyms (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants (id) on delete cascade,
  terms text[] not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint storefront_search_synonyms_terms_chk
    check (cardinality(terms) between 2 and 12)
);

create index if not exists storefront_search_synonyms_tenant_idx
  on public.storefront_search_synonyms (tenant_id);

comment on table public.storefront_search_synonyms is
  'Kereső szinonimák: egy sor = egyenértékű kifejezések (normalizálva). tenant_id null = alapértelmezett, minden boltra.';

create table if not exists public.storefront_search_log (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  q text not null,
  q_norm text not null,
  source text not null default 'page',
  results integer,
  corrected text,
  relaxed boolean not null default false,
  clicked_id uuid references public.accessories (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint storefront_search_log_q_len check (char_length(q) <= 120),
  constraint storefront_search_log_source_chk check (source in ('page', 'suggest', 'click'))
);

create index if not exists storefront_search_log_tenant_time_idx
  on public.storefront_search_log (tenant_id, created_at desc);
create index if not exists storefront_search_log_tenant_q_idx
  on public.storefront_search_log (tenant_id, q_norm)
  where clicked_id is not null;

-- ---------------------------------------------------------------------------
-- 3) Index építés
-- ---------------------------------------------------------------------------
create or replace function public.storefront_search_build(p_tenant uuid, p_ids uuid[])
returns void
language sql
volatile
security definer
set search_path = public, extensions
as $$
  with src as (
    select
      a.id,
      w.tenant_id,
      c.id as category_id,
      coalesce(nullif(btrim(w.web_group_id), ''), a.id::text) as group_key,
      coalesce(nullif(btrim(w.web_title), ''), a.name) as title,
      a.name,
      concat_ws(' ', c.name, pc.name, w.web_brand, m.name,
        array_to_string(w.web_search_aliases, ' '),
        array_to_string(w.web_tags, ' ')) as txt_b,
      concat_ws(' ', w.web_color, w.web_size, w.web_material, nums.txt, lbls.txt) as txt_c,
      concat_ws(' ', w.web_description_short,
        left(regexp_replace(coalesce(w.web_description_long, ''), '<[^>]+>', ' ', 'g'), 3000)) as txt_d,
      array_remove(array[
        public.storefront_code(a.sku),
        public.storefront_code(a.barcode),
        public.storefront_code(w.web_gtin),
        public.storefront_code(w.web_mpn)
      ], null) as codes,
      concat_ws(' ', a.sku, w.web_mpn) as code_txt,
      coalesce(o.n, 0)::int as orders
    from public.accessory_web w
    join public.accessories a on a.id = w.accessory_id
    left join public.manufacturers m on m.id = a.manufacturer_id
    left join public.web_categories c on c.id = w.web_category_id and c.deleted_at is null
    left join public.web_categories pc on pc.id = c.parent_id and pc.deleted_at is null
    left join lateral (
      select string_agg(
        public.storefront_num_text(i.value_num) || ' ' || coalesce(pa.unit, ''), ' '
      ) as txt
      from public.accessory_attribute_inputs i
      join public.product_attributes pa on pa.id = i.attribute_id
      where i.accessory_id = a.id and i.value_num is not null
    ) nums on true
    left join lateral (
      select string_agg(av.label, ' ') as txt
      from public.accessory_attribute_values aav
      join public.attribute_values av on av.id = aav.attribute_value_id
      where aav.accessory_id = a.id and av.deleted_at is null
    ) lbls on true
    left join lateral (
      select count(distinct i.sales_order_id) as n
      from public.sales_order_items i
      join public.sales_orders so on so.id = i.sales_order_id
      where i.tenant_id = p_tenant
        and i.accessory_id = a.id
        and i.item_kind = 'product'
        and i.deleted_at is null
        and so.deleted_at is null
        and so.status in ('confirmed', 'fulfilled', 'partially_returned')
        and so.created_at >= now() - interval '180 days'
    ) o on true
    where w.tenant_id = p_tenant
      and (p_ids is null or a.id = any (p_ids))
      and w.sellable_web
      and w.web_slug is not null
      and a.active
      and a.deleted_at is null
  )
  insert into public.storefront_search_index (
    accessory_id, tenant_id, category_id, group_key, title, title_norm,
    doc_norm, vocab, codes, tsv, orders, indexed_at
  )
  select
    s.id,
    s.tenant_id,
    s.category_id,
    s.group_key,
    s.title,
    public.storefront_norm(s.title),
    public.storefront_norm(concat_ws(' ', s.title, s.name, s.txt_b, s.txt_c, s.code_txt)),
    concat_ws(' ', s.title, s.txt_b, s.txt_c),
    s.codes,
    setweight(to_tsvector('public.hu_search', concat_ws(' ', s.title, s.name)), 'A')
      || setweight(to_tsvector('public.hu_search', s.txt_b), 'B')
      || setweight(to_tsvector('public.hu_search', s.txt_c), 'C')
      || setweight(to_tsvector('public.hu_search', s.txt_d), 'D'),
    s.orders,
    now()
  from src s
  on conflict (accessory_id) do update set
    tenant_id = excluded.tenant_id,
    category_id = excluded.category_id,
    group_key = excluded.group_key,
    title = excluded.title,
    title_norm = excluded.title_norm,
    doc_norm = excluded.doc_norm,
    vocab = excluded.vocab,
    codes = excluded.codes,
    tsv = excluded.tsv,
    orders = excluded.orders,
    indexed_at = excluded.indexed_at;
$$;

create or replace function public.storefront_search_refresh(p_tenant uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_full boolean;
  v_ids uuid[];
begin
  if not pg_try_advisory_xact_lock(hashtextextended('storefront_search:' || p_tenant::text, 0)) then
    return;
  end if;

  select s.dirty_all into v_full
  from public.storefront_search_state s
  where s.tenant_id = p_tenant;
  v_full := coalesce(v_full, true);

  if v_full then
    delete from public.storefront_search_queue q where q.tenant_id = p_tenant;
    delete from public.storefront_search_index i where i.tenant_id = p_tenant;
    perform public.storefront_search_build(p_tenant, null);
  else
    with d as (
      delete from public.storefront_search_queue q
      where q.tenant_id = p_tenant
      returning q.accessory_id
    )
    select array_agg(d.accessory_id) into v_ids from d;
    if v_ids is null then
      return;
    end if;
    delete from public.storefront_search_index i
    where i.tenant_id = p_tenant and i.accessory_id = any (v_ids);
    perform public.storefront_search_build(p_tenant, v_ids);
  end if;

  delete from public.storefront_search_terms t where t.tenant_id = p_tenant;
  insert into public.storefront_search_terms (tenant_id, term, surface, freq)
  select p_tenant, w.term, mode() within group (order by w.surface), count(distinct i.accessory_id)::int
  from public.storefront_search_index i
  cross join lateral (
    select distinct lower(x) as surface, lower(unaccent(x)) as term
    from regexp_split_to_table(i.vocab, '[^a-zA-ZáéíóöőúüűÁÉÍÓÖŐÚÜŰäÄ]+') x
    where char_length(x) between 3 and 40
  ) w
  where i.tenant_id = p_tenant
  group by w.term;

  delete from public.storefront_search_log l
  where l.tenant_id = p_tenant and l.created_at < now() - interval '180 days';

  insert into public.storefront_search_state (tenant_id, dirty_all, built_at)
  values (p_tenant, false, now())
  on conflict (tenant_id) do update set dirty_all = false, built_at = now();
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) Triggerek: változás → sor / teljes újraépítés jelző
-- ---------------------------------------------------------------------------
create or replace function public.storefront_search_touch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_tenant uuid;
  v_acc uuid;
begin
  if tg_op = 'DELETE' then
    v_row := to_jsonb(old);
  else
    v_row := to_jsonb(new);
  end if;
  v_tenant := nullif(v_row ->> 'tenant_id', '')::uuid;
  if v_tenant is null then
    return null;
  end if;
  if tg_argv[0] = '*' then
    insert into public.storefront_search_state (tenant_id, dirty_all)
    values (v_tenant, true)
    on conflict (tenant_id) do update set dirty_all = true
    where not public.storefront_search_state.dirty_all;
  else
    v_acc := nullif(v_row ->> tg_argv[0], '')::uuid;
    if v_acc is not null then
      insert into public.storefront_search_queue (tenant_id, accessory_id)
      values (v_tenant, v_acc)
      on conflict do nothing;
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists storefront_search_touch on public.accessory_web;
create trigger storefront_search_touch
  after insert or update or delete on public.accessory_web
  for each row execute function public.storefront_search_touch('accessory_id');

drop trigger if exists storefront_search_touch on public.accessories;
create trigger storefront_search_touch
  after insert or delete or update of name, sku, barcode, active, deleted_at, manufacturer_id
  on public.accessories
  for each row execute function public.storefront_search_touch('id');

drop trigger if exists storefront_search_touch on public.accessory_attribute_inputs;
create trigger storefront_search_touch
  after insert or update or delete on public.accessory_attribute_inputs
  for each row execute function public.storefront_search_touch('accessory_id');

drop trigger if exists storefront_search_touch on public.accessory_attribute_values;
create trigger storefront_search_touch
  after insert or update or delete on public.accessory_attribute_values
  for each row execute function public.storefront_search_touch('accessory_id');

drop trigger if exists storefront_search_touch on public.web_categories;
create trigger storefront_search_touch
  after insert or delete or update of name, parent_id, deleted_at on public.web_categories
  for each row execute function public.storefront_search_touch('*');

drop trigger if exists storefront_search_touch on public.manufacturers;
create trigger storefront_search_touch
  after update or delete on public.manufacturers
  for each row execute function public.storefront_search_touch('*');

drop trigger if exists storefront_search_touch on public.product_attributes;
create trigger storefront_search_touch
  after update or delete on public.product_attributes
  for each row execute function public.storefront_search_touch('*');

drop trigger if exists storefront_search_touch on public.attribute_values;
create trigger storefront_search_touch
  after update or delete on public.attribute_values
  for each row execute function public.storefront_search_touch('*');

-- ---------------------------------------------------------------------------
-- 5) Keresés
-- p_groups: [["fogantyu","fogo"],["128"]] — csoportonként alternatívák (javítva,
-- szinonimákkal bővítve, a TS oldal adja). Egy csoport akkor egyezik, ha bármelyik
-- alternatívája szó-eleje egyezés a dokumentumban vagy a tsvector (tő) egyezik.
-- Számok csak egész szóként egyeznek (12 ≠ 128).
-- Ha semmi nem egyezik minden csoportra, a legtöbb csoportot teljesítők jönnek
-- (best_matched < groups → „lazított” találat).
-- ---------------------------------------------------------------------------
create or replace function public.storefront_search_v2(
  p_tenant uuid,
  p_groups jsonb,
  p_codes text[] default '{}',
  p_norm text default '',
  p_categories uuid[] default '{}',
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  accessory_id uuid,
  category_id uuid,
  score real,
  matched integer,
  code_hit boolean,
  groups integer,
  best_matched integer,
  total_count bigint,
  category_count bigint
)
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
#variable_conflict use_column
begin
  if exists (select 1 from public.storefront_search_queue q where q.tenant_id = p_tenant)
     or not exists (
       select 1 from public.storefront_search_state s
       where s.tenant_id = p_tenant and not s.dirty_all
     ) then
    perform public.storefront_search_refresh(p_tenant);
  end if;

  return query
  with alts as (
    select
      g.ord::int as gi,
      a.alt,
      a.alt ~ '^[0-9.]+$' as num,
      case
        when a.alt ~ '^[0-9.]+$' then null
        when position(' ' in a.alt) > 0 then phraseto_tsquery('public.hu_search', a.alt)
        else to_tsquery('public.hu_search', quote_literal(a.alt) || ':*')
      end as tsq
    from jsonb_array_elements(coalesce(p_groups, '[]'::jsonb)) with ordinality g(arr, ord)
    cross join lateral jsonb_array_elements_text(g.arr) a(alt)
    where a.alt ~ '^[a-z0-9. ]{1,60}$'
  ),
  ng as (
    select count(distinct al.gi)::int as n from alts al
  ),
  clicks as (
    select l.clicked_id, count(*)::int as n
    from public.storefront_search_log l
    where l.tenant_id = p_tenant
      and l.q_norm = coalesce(p_norm, '')
      and l.clicked_id is not null
      and l.created_at >= now() - interval '90 days'
    group by l.clicked_id
  ),
  cand as (
    select
      i.accessory_id,
      i.category_id,
      i.group_key,
      i.title_norm,
      i.orders,
      coalesce(i.codes && p_codes, false) as code_hit,
      m.matched,
      m.rank,
      m.title_hits
    from public.storefront_search_index i
    cross join lateral (
      select
        count(distinct x.gi)::int as matched,
        coalesce(sum(x.r), 0)::real as rank,
        count(distinct x.gi) filter (where x.in_title)::int as title_hits
      from (
        select
          al.gi,
          case when al.tsq is null then 0 else ts_rank(i.tsv, al.tsq) end as r,
          position(
            ' ' || al.alt || case when al.num then ' ' else '' end
            in ' ' || i.title_norm || ' '
          ) > 0 as in_title
        from alts al
        where case
          when al.num then position(' ' || al.alt || ' ' in ' ' || i.doc_norm || ' ') > 0
          else position(' ' || al.alt in ' ' || i.doc_norm) > 0
            or (al.tsq is not null and i.tsv @@ al.tsq)
        end
      ) x
    ) m
    where i.tenant_id = p_tenant
      and (m.matched > 0 or coalesce(i.codes && p_codes, false))
  ),
  scored as (
    select
      c.*,
      (
        c.matched * 10
        + case when c.code_hit then 100 else 0 end
        + c.title_hits * 2
        + least(c.rank, 1) * 5
        + case when coalesce(p_norm, '') <> '' and position(p_norm in c.title_norm) > 0 then 4 else 0 end
        + case when coalesce(p_norm, '') <> '' and c.title_norm like p_norm || '%' then 2 else 0 end
        + similarity(c.title_norm, coalesce(p_norm, '')) * 3
        + case when c.category_id = any (coalesce(p_categories, '{}')) then 3 else 0 end
        + ln(1 + c.orders) * 0.6
        + ln(1 + coalesce(k.n, 0)) * 1.5
      )::real as score
    from cand c
    left join clicks k on k.clicked_id = c.accessory_id
  ),
  best as (
    select coalesce(max(s.matched), 0)::int as n from scored s
  ),
  kept as (
    select s.*, row_number() over (partition by s.group_key order by s.score desc, s.title_norm) as rn
    from scored s, best b
    where s.code_hit or s.matched >= b.n
  ),
  final as (
    select k.*, count(*) over () as total, count(*) over (partition by k.category_id) as cat_total
    from kept k
    where k.rn = 1
  )
  select
    f.accessory_id,
    f.category_id,
    f.score,
    f.matched,
    f.code_hit,
    (select n from ng),
    (select n from best),
    f.total,
    f.cat_total
  from final f
  order by f.code_hit desc, f.matched desc, f.score desc, f.title_norm
  limit greatest(1, least(coalesce(p_limit, 24), 200))
  offset greatest(0, coalesce(p_offset, 0));
end;
$$;

-- ---------------------------------------------------------------------------
-- 6) Szótár a lekérdezés-értelmezéshez (TS gyorsítótárazza)
-- ---------------------------------------------------------------------------
create or replace function public.storefront_search_dictionary(p_tenant uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
begin
  if exists (select 1 from public.storefront_search_queue q where q.tenant_id = p_tenant)
     or not exists (
       select 1 from public.storefront_search_state s
       where s.tenant_id = p_tenant and not s.dirty_all
     ) then
    perform public.storefront_search_refresh(p_tenant);
  end if;

  return jsonb_build_object(
    'terms', coalesce((
      select jsonb_agg(jsonb_build_array(t.term, t.freq, t.surface))
      from (
        select term, freq, surface from public.storefront_search_terms
        where tenant_id = p_tenant
        order by freq desc, term
        limit 20000
      ) t
    ), '[]'::jsonb),
    'synonyms', coalesce((
      select jsonb_agg(s.terms)
      from public.storefront_search_synonyms s
      where s.tenant_id is null or s.tenant_id = p_tenant
    ), '[]'::jsonb),
    'attrs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pa.id, 'name', pa.name, 'code', pa.code, 'type', pa.value_type, 'unit', pa.unit
      ))
      from public.product_attributes pa
      where pa.tenant_id = p_tenant and pa.active and pa.deleted_at is null
        and pa.value_type in ('number', 'list')
    ), '[]'::jsonb),
    'templates', coalesce((
      select jsonb_agg(jsonb_build_array(t.category_id, t.attribute_id, t.role, t.sort_order))
      from public.web_category_attributes t
      where t.tenant_id = p_tenant
    ), '[]'::jsonb),
    'values', coalesce((
      select jsonb_agg(jsonb_build_array(v.category_id, v.attribute_id, v.num, v.label, v.n))
      from (
        select w.web_category_id as category_id, i.attribute_id, i.value_num as num,
               null::text as label, count(*)::int as n
        from public.accessory_attribute_inputs i
        join public.accessory_web w on w.accessory_id = i.accessory_id
        join public.storefront_search_index x on x.accessory_id = i.accessory_id
        where i.tenant_id = p_tenant and w.web_category_id is not null and i.value_num is not null
        group by 1, 2, 3
        union all
        select w.web_category_id, av.attribute_id, null::numeric, av.label, count(*)::int
        from public.accessory_attribute_values aav
        join public.attribute_values av on av.id = aav.attribute_value_id and av.deleted_at is null
        join public.accessory_web w on w.accessory_id = aav.accessory_id
        join public.storefront_search_index x on x.accessory_id = aav.accessory_id
        where aav.tenant_id = p_tenant and w.web_category_id is not null
        group by 1, 2, 4
      ) v
    ), '[]'::jsonb),
    'popular', coalesce((
      select jsonb_agg(jsonb_build_array(p.q_norm, p.q, p.n))
      from (
        select l.q_norm, min(l.q) as q, count(*)::int as n
        from public.storefront_search_log l
        where l.tenant_id = p_tenant
          and l.source = 'page'
          and coalesce(l.results, 0) > 0
          and l.created_at >= now() - interval '60 days'
        group by l.q_norm
        having count(*) >= 2
        order by count(*) desc
        limit 300
      ) p
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 7) Admin riport (Webshop → Keresések)
-- ---------------------------------------------------------------------------
create or replace function public.storefront_search_report(p_tenant uuid, p_days integer default 30)
returns table (
  q_norm text,
  q text,
  searches integer,
  zero integer,
  avg_results real,
  clicks integer,
  last_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.q_norm,
    (array_agg(l.q order by l.created_at desc))[1],
    count(*) filter (where l.source = 'page')::int,
    count(*) filter (where l.source = 'page' and coalesce(l.results, 0) = 0)::int,
    avg(l.results) filter (where l.source = 'page')::real,
    count(*) filter (where l.source = 'click')::int,
    max(l.created_at)
  from public.storefront_search_log l
  where l.tenant_id = p_tenant
    and public.is_tenant_member(p_tenant)
    and l.created_at >= now() - make_interval(days => greatest(1, least(p_days, 180)))
  group by l.q_norm
  order by count(*) filter (where l.source = 'page') desc, max(l.created_at) desc
  limit 500;
$$;

-- ---------------------------------------------------------------------------
-- 8) RLS + jogok
-- ---------------------------------------------------------------------------
alter table public.storefront_search_index enable row level security;
alter table public.storefront_search_queue enable row level security;
alter table public.storefront_search_state enable row level security;
alter table public.storefront_search_terms enable row level security;
alter table public.storefront_search_synonyms enable row level security;
alter table public.storefront_search_log enable row level security;

drop policy if exists storefront_search_synonyms_select on public.storefront_search_synonyms;
create policy storefront_search_synonyms_select
  on public.storefront_search_synonyms for select to authenticated
  using (tenant_id is null or public.is_tenant_member(tenant_id));

drop policy if exists storefront_search_synonyms_insert on public.storefront_search_synonyms;
create policy storefront_search_synonyms_insert
  on public.storefront_search_synonyms for insert to authenticated
  with check (tenant_id is not null and public.can_write_tenant(tenant_id));

drop policy if exists storefront_search_synonyms_update on public.storefront_search_synonyms;
create policy storefront_search_synonyms_update
  on public.storefront_search_synonyms for update to authenticated
  using (tenant_id is not null and public.can_write_tenant(tenant_id))
  with check (tenant_id is not null and public.can_write_tenant(tenant_id));

drop policy if exists storefront_search_synonyms_delete on public.storefront_search_synonyms;
create policy storefront_search_synonyms_delete
  on public.storefront_search_synonyms for delete to authenticated
  using (tenant_id is not null and public.can_write_tenant(tenant_id));

revoke all on function public.storefront_search_build(uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.storefront_search_refresh(uuid) from public, anon, authenticated;
revoke all on function public.storefront_search_v2(uuid, jsonb, text[], text, uuid[], integer, integer) from public, anon, authenticated;
revoke all on function public.storefront_search_dictionary(uuid) from public, anon, authenticated;
revoke all on function public.storefront_search_report(uuid, integer) from public, anon;
revoke all on function public.storefront_search_touch() from public, anon, authenticated;

grant execute on function public.storefront_search_refresh(uuid) to service_role;
grant execute on function public.storefront_search_v2(uuid, jsonb, text[], text, uuid[], integer, integer) to service_role;
grant execute on function public.storefront_search_dictionary(uuid) to service_role;
grant execute on function public.storefront_search_report(uuid, integer) to authenticated, service_role;

grant select, insert, update, delete on public.storefront_search_synonyms to authenticated;
grant all on public.storefront_search_index, public.storefront_search_queue,
  public.storefront_search_state, public.storefront_search_terms,
  public.storefront_search_synonyms, public.storefront_search_log to service_role;

-- ---------------------------------------------------------------------------
-- 9) Alapértelmezett szinonimák (bútorvasalat / lakberendezés)
-- ---------------------------------------------------------------------------
insert into public.storefront_search_synonyms (tenant_id, terms)
select null, s.terms
from (values
  (array['zsaner', 'pant', 'ajtopant', 'butorpant', 'butorzsaner']),
  (array['fiokcsuszo', 'fioksin', 'fiok sin', 'fiokkihuzo', 'fiokvasalat']),
  (array['golyos sin', 'golyos fiokcsuszo', 'teleszkopos sin', 'teleszkopos fiokcsuszo']),
  (array['fogantyu', 'fogo', 'butorfogo', 'butorfogantyu', 'kilincs']),
  (array['gomb', 'butorgomb', 'gombfogantyu']),
  (array['fogas', 'akaszto', 'ruhaakaszto', 'ruhafogas']),
  (array['polctarto', 'polc tarto', 'konzol', 'polckonzol']),
  (array['butorlab', 'lab', 'szekrenylab', 'labazat', 'allithato lab']),
  (array['csillapito', 'fekezo', 'soft close', 'softclose', 'puhazaro', 'lassu zaras']),
  (array['led szalag', 'ledszalag', 'led csik', 'fenycsik']),
  (array['munkalap', 'konyhapult', 'pult']),
  (array['zar', 'butorzar', 'elzaro']),
  (array['rozsdamentes', 'inox', 'nemesacel']),
  (array['fekete', 'black']),
  (array['feher', 'white']),
  (array['arany', 'gold']),
  (array['ezust', 'silver']),
  (array['kihuzhato', 'kihuzos'])
) as s(terms)
where not exists (
  select 1 from public.storefront_search_synonyms x
  where x.tenant_id is null and x.terms = s.terms
);
