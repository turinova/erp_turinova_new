-- POS barcode lookup: HU QWERTZ / wedge tolerant match
-- - lower(sku) (már 20260605)
-- - hyphen-compact: DT-CZ00127781 ↔ DTCZ00127781
-- - expression index a compact barcode-ra (gyors path)
-- Y↔Z variánsokat a kliens küldi külön p_code-ként (barcodeLookupCandidates).

create index if not exists accessories_barcode_compact_idx
  on public.accessories (
    tenant_id,
    (upper(regexp_replace(coalesce(barcode, ''), '[^0-9A-Za-z]', '', 'g')))
  )
  where deleted_at is null
    and barcode is not null
    and length(regexp_replace(coalesce(barcode, ''), '[^0-9A-Za-z]', '', 'g')) > 0;

create index if not exists accessories_barcode_internal_compact_idx
  on public.accessories (
    tenant_id,
    (upper(regexp_replace(coalesce(barcode_internal, ''), '[^0-9A-Za-z]', '', 'g')))
  )
  where deleted_at is null
    and barcode_internal is not null
    and length(regexp_replace(coalesce(barcode_internal, ''), '[^0-9A-Za-z]', '', 'g')) > 0;

create or replace function public.lookup_pos_barcode(
  p_tenant_id uuid,
  p_code text,
  p_warehouse_id uuid
)
returns table (
  id uuid,
  name text,
  sku text,
  price_net numeric,
  price_gross numeric,
  barcode text,
  barcode_internal text,
  image_url text,
  tax_rate_percent numeric,
  unit_shortform text,
  on_hand numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with params as (
    select
      upper(trim(both from coalesce(p_code, ''))) as code,
      upper(regexp_replace(coalesce(p_code, ''), '[^0-9A-Za-z]', '', 'g')) as code_compact
  ),
  hit as (
    select a.*
    from public.accessories a
    cross join params p
    where a.tenant_id = p_tenant_id
      and a.active = true
      and a.deleted_at is null
      and coalesce(a.sellable_pos, true) = true
      and p.code <> ''
      and (
        a.barcode = p.code
        or a.barcode_internal = p.code
        or lower(a.sku) = lower(p.code)
        or (
          p.code_compact <> ''
          and upper(regexp_replace(coalesce(a.barcode, ''), '[^0-9A-Za-z]', '', 'g'))
            = p.code_compact
        )
        or (
          p.code_compact <> ''
          and upper(regexp_replace(coalesce(a.barcode_internal, ''), '[^0-9A-Za-z]', '', 'g'))
            = p.code_compact
        )
      )
    order by
      case
        when a.barcode = p.code then 0
        when a.barcode_internal = p.code then 1
        when lower(a.sku) = lower(p.code) then 2
        else 3
      end
    limit 1
  )
  select
    h.id,
    h.name,
    h.sku,
    h.price_net,
    coalesce(h.price_gross, round(h.price_net * (1 + coalesce(t.rate_percent, 0) / 100.0)))::numeric,
    h.barcode,
    h.barcode_internal,
    h.image_url,
    coalesce(t.rate_percent, 0)::numeric as tax_rate_percent,
    coalesce(u.shortform, 'db') as unit_shortform,
    public.accessory_on_hand(p_tenant_id, h.id, p_warehouse_id) as on_hand
  from hit h
  left join public.tax_rates t on t.id = h.tax_rate_id
  left join public.units u on u.id = h.unit_id;
$$;

revoke all on function public.lookup_pos_barcode(uuid, text, uuid) from public;
grant execute on function public.lookup_pos_barcode(uuid, text, uuid) to authenticated;
