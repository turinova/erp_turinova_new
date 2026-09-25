-- Storefront jogi minimum (doc 38/39):
-- 1) tenant_webshop_settings: tárhely-szolgáltató (Ekertv. 4. §), ÁSZF / adatkezelés URL, panaszkezelés
-- 2) manufacturers: GPSR (EU 2023/988 19. cikk) gyártó + EU felelős személy elérhetőség
-- 3) accessories.web_safety_info: figyelmeztetés / biztonsági információ magyarul
-- 4) accessory_price_history + storefront_reference_price: előző 30 nap legalacsonyabb ára (Omnibus)
-- 5) Takarítás: régi automatikus „Méret” / „Teherbírás” web_specs kulcsok

-- ---------------------------------------------------------------------------
-- 1) Jogi adatok a bolt beállításokban
-- ---------------------------------------------------------------------------
alter table public.tenant_webshop_settings
  add column if not exists hosting_provider_name text,
  add column if not exists hosting_provider_address text,
  add column if not exists hosting_provider_email text,
  add column if not exists terms_url text,
  add column if not exists privacy_url text,
  add column if not exists complaint_info text;

-- ---------------------------------------------------------------------------
-- 2) Gyártó GPSR adatok
-- ---------------------------------------------------------------------------
alter table public.manufacturers
  add column if not exists legal_name text,
  add column if not exists postal_address text,
  add column if not exists email text,
  add column if not exists website text,
  add column if not exists eu_rep_name text,
  add column if not exists eu_rep_address text,
  add column if not exists eu_rep_email text;

-- ---------------------------------------------------------------------------
-- 3) Termék biztonsági információ
-- ---------------------------------------------------------------------------
alter table public.accessories
  add column if not exists web_safety_info text;

alter table public.accessories
  drop constraint if exists accessories_web_safety_info_len_chk;
alter table public.accessories
  add constraint accessories_web_safety_info_len_chk
  check (web_safety_info is null or char_length(web_safety_info) <= 2000);

-- ---------------------------------------------------------------------------
-- 4) Árelőzmény
-- ---------------------------------------------------------------------------
create table if not exists public.accessory_price_history (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  accessory_id uuid not null references public.accessories (id) on delete cascade,
  price_net numeric(14, 4) not null,
  valid_from timestamptz not null default now()
);

create index if not exists accessory_price_history_lookup_idx
  on public.accessory_price_history (accessory_id, valid_from desc);

alter table public.accessory_price_history enable row level security;

drop policy if exists accessory_price_history_select on public.accessory_price_history;
create policy accessory_price_history_select
  on public.accessory_price_history for select to authenticated
  using (public.is_tenant_member(tenant_id));

create or replace function public.accessories_track_price()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.price_net is distinct from old.price_net then
    insert into public.accessory_price_history (tenant_id, accessory_id, price_net)
    values (new.tenant_id, new.id, new.price_net);
  end if;
  return new;
end;
$$;

drop trigger if exists accessories_track_price_trg on public.accessories;
create trigger accessories_track_price_trg
  after insert or update of price_net on public.accessories
  for each row
  when (new.price_net is not null)
  execute function public.accessories_track_price();

-- Kiinduló állapot: a mai ár az első bejegyzés — így nincs visszamenőleges „akció”.
insert into public.accessory_price_history (tenant_id, accessory_id, price_net, valid_from)
select a.tenant_id, a.id, a.price_net, now()
from public.accessories a
where a.price_net is not null
  and not exists (
    select 1 from public.accessory_price_history h where h.accessory_id = a.id
  );

-- Az aktuális ár érvénybe lépése előtti 30 napban érvényes árak minimuma.
-- NULL, ha nincs korábbi ár (nincs mihez viszonyítani).
create or replace function public.storefront_reference_price(
  p_tenant_id uuid,
  p_accessory_id uuid
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  with periods as (
    select
      h.price_net,
      h.valid_from,
      lead(h.valid_from) over (order by h.valid_from, h.id) as valid_to,
      row_number() over (order by h.valid_from desc, h.id desc) as rn
    from public.accessory_price_history h
    where h.tenant_id = p_tenant_id
      and h.accessory_id = p_accessory_id
  ),
  cur as (
    select valid_from from periods where rn = 1
  )
  select min(p.price_net)
  from periods p, cur
  where p.rn > 1
    and p.valid_to > cur.valid_from - interval '30 days';
$$;

revoke all on function public.storefront_reference_price(uuid, uuid) from public, anon, authenticated;
grant execute on function public.storefront_reference_price(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 5) Régi automatikus web_specs kulcsok takarítása
-- Csak ha az érték pontosan az, amit a régi parser a névből / leírásból kinyert.
-- ---------------------------------------------------------------------------
with src as (
  select
    a.id,
    k.key,
    k.unit,
    a.web_specs ->> k.key as val,
    replace(
      coalesce(a.name, '') || E'\n' ||
      coalesce(a.web_description_short, '') || E'\n' ||
      coalesce(a.web_description_long, ''),
      ',', '.'
    ) as txt
  from public.accessories a
  cross join (values ('Méret', 'mm'), ('Teherbírás', 'kg')) as k (key, unit)
  where a.web_specs ? k.key
),
junk as (
  select id, key
  from src
  where val ~ ('^\d+(\.\d+)? ' || unit || '$')
    and txt ~* (
      '(^|[^0-9.])' ||
      replace(split_part(val, ' ', 1), '.', '\.') ||
      '\s*' || unit || '\M'
    )
)
update public.accessories a
set web_specs = a.web_specs - j.keys
from (
  select id, array_agg(key) as keys from junk group by id
) j
where a.id = j.id;
