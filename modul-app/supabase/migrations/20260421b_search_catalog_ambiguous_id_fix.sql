-- Hotfix: RETURNS TABLE "id" shadowed columns → ambiguous reference.
-- Futtasd ezt a teljes fájlt a SQL Editorban (CREATE OR REPLACE).

create or replace function public.search_materials_catalog(
  p_tenant_id uuid,
  p_q text,
  p_kinds text[] default array['sheet', 'linear', 'accessory'],
  p_limit int default 25,
  p_offset int default 0
)
returns table (
  kind text,
  id uuid,
  name text,
  manufacturer_name text,
  type_label text,
  sku text,
  length_mm integer,
  width_mm integer,
  thickness_mm numeric,
  on_stock boolean,
  price_gross_per_m numeric,
  price_gross_sqm numeric,
  price_gross_piece numeric,
  unit_shortform text,
  total_count bigint
)
language plpgsql
stable
security invoker
set search_path = public
as $$
#variable_conflict use_column
declare
  v_q text := trim(both from coalesce(p_q, ''));
  v_pattern text;
  v_limit int := greatest(1, least(coalesce(p_limit, 25), 50));
  v_offset int := greatest(0, coalesce(p_offset, 0));
  v_kinds text[] := coalesce(p_kinds, array['sheet', 'linear', 'accessory']);
  v_can boolean;
begin
  if v_q = '' or length(v_q) < 1 then
    return;
  end if;

  -- AuthZ: staff member VAGY partner a kapcsolt tenant katalógusára
  v_can := public.is_tenant_member(p_tenant_id)
    or public.partner_can_read_tenant_catalog(p_tenant_id);
  if not v_can then
    raise exception 'not authorized for tenant catalog'
      using errcode = '42501';
  end if;

  v_pattern := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
  with mfr as (
    select m.id as manufacturer_id
    from public.manufacturers m
    where m.tenant_id = p_tenant_id
      and m.deleted_at is null
      and m.name ilike v_pattern escape '\'
    limit 50
  ),
  sheet_rows as (
    select
      'sheet'::text as kind,
      s.id,
      s.name,
      coalesce(m.name, '—')::text as manufacturer_name,
      'Bútorlap'::text as type_label,
      null::text as sku,
      s.length_mm,
      s.width_mm,
      s.thickness_mm,
      s.on_stock,
      null::numeric as price_gross_per_m,
      round(s.price_net * (1 + coalesce(t.rate_percent, 0) / 100.0))::numeric as price_gross_sqm,
      round(
        s.price_net * (1 + coalesce(t.rate_percent, 0) / 100.0)
        * (s.length_mm::numeric / 1000.0) * (s.width_mm::numeric / 1000.0)
      )::numeric as price_gross_piece,
      null::text as unit_shortform
    from public.sheet_materials s
    left join public.manufacturers m on m.id = s.manufacturer_id
    left join public.tax_rates t on t.id = s.tax_rate_id
    where 'sheet' = any (v_kinds)
      and s.tenant_id = p_tenant_id
      and s.active = true
      and s.deleted_at is null
      and (
        s.name ilike v_pattern escape '\'
        or (s.machine_code is not null and s.machine_code ilike v_pattern escape '\')
        or s.manufacturer_id in (select manufacturer_id from mfr)
      )
    order by s.name asc
    limit 40
  ),
  linear_rows as (
    select
      'linear'::text as kind,
      s.id,
      s.name,
      coalesce(m.name, '—')::text as manufacturer_name,
      case s.material_type
        when 'hatfal' then 'Hátfal'
        when 'munkalap' then 'Munkalap'
        when 'asztalap' then 'Asztalap'
        else s.material_type
      end::text as type_label,
      null::text as sku,
      s.length_mm,
      s.width_mm,
      s.thickness_mm,
      s.on_stock,
      round(s.price_net * (1 + coalesce(t.rate_percent, 0) / 100.0))::numeric as price_gross_per_m,
      null::numeric as price_gross_sqm,
      round(
        s.price_net * (1 + coalesce(t.rate_percent, 0) / 100.0)
        * (s.length_mm::numeric / 1000.0)
      )::numeric as price_gross_piece,
      null::text as unit_shortform
    from public.linear_materials s
    left join public.manufacturers m on m.id = s.manufacturer_id
    left join public.tax_rates t on t.id = s.tax_rate_id
    where 'linear' = any (v_kinds)
      and s.tenant_id = p_tenant_id
      and s.active = true
      and s.deleted_at is null
      and (
        s.name ilike v_pattern escape '\'
        or s.manufacturer_id in (select manufacturer_id from mfr)
      )
    order by s.name asc
    limit 40
  ),
  accessory_rows as (
    select
      'accessory'::text as kind,
      s.id,
      s.name,
      coalesce(m.name, '—')::text as manufacturer_name,
      'Termék'::text as type_label,
      s.sku::text as sku,
      null::integer as length_mm,
      null::integer as width_mm,
      null::numeric as thickness_mm,
      null::boolean as on_stock,
      null::numeric as price_gross_per_m,
      null::numeric as price_gross_sqm,
      round(s.price_net * (1 + coalesce(t.rate_percent, 0) / 100.0))::numeric as price_gross_piece,
      coalesce(u.shortform, 'db')::text as unit_shortform
    from public.accessories s
    left join public.manufacturers m on m.id = s.manufacturer_id
    left join public.tax_rates t on t.id = s.tax_rate_id
    left join public.units u on u.id = s.unit_id
    where 'accessory' = any (v_kinds)
      and s.tenant_id = p_tenant_id
      and s.active = true
      and s.deleted_at is null
      and (
        s.name ilike v_pattern escape '\'
        or s.sku ilike v_pattern escape '\'
        or (s.barcode is not null and s.barcode ilike v_pattern escape '\')
        or (s.barcode_internal is not null and s.barcode_internal ilike v_pattern escape '\')
        or s.manufacturer_id in (select manufacturer_id from mfr)
      )
    order by s.name asc
    limit 40
  ),
  combined as (
    select * from sheet_rows
    union all
    select * from linear_rows
    union all
    select * from accessory_rows
  ),
  numbered as (
    select
      c.*,
      count(*) over () as total_count,
      row_number() over (order by lower(c.name), lower(c.manufacturer_name), c.kind, c.id) as rn
    from combined c
  )
  select
    n.kind,
    n.id,
    n.name,
    n.manufacturer_name,
    n.type_label,
    n.sku,
    n.length_mm,
    n.width_mm,
    n.thickness_mm,
    n.on_stock,
    n.price_gross_per_m,
    n.price_gross_sqm,
    n.price_gross_piece,
    n.unit_shortform,
    n.total_count
  from numbered n
  where n.rn > v_offset
    and n.rn <= v_offset + v_limit
  order by n.rn;
end;
$$;

revoke all on function public.search_materials_catalog(uuid, text, text[], int, int) from public;
grant execute on function public.search_materials_catalog(uuid, text, text[], int, int) to authenticated;

comment on function public.search_materials_catalog is
  'Unified anyagkereső (táblás/szálas/termék) — egy roundtrip, staff vagy partner RLS.';
