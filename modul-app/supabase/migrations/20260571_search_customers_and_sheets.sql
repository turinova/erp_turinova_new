-- Async typeahead: ügyfél + Opti táblás anyag (500-as hard limit helyett).

create extension if not exists pg_trgm;

create index if not exists customers_name_trgm_idx
  on public.customers using gin (name gin_trgm_ops)
  where deleted_at is null;

create index if not exists customers_billing_name_trgm_idx
  on public.customers using gin (billing_name gin_trgm_ops)
  where deleted_at is null and billing_name is not null;

create index if not exists sheet_materials_name_trgm_idx
  on public.sheet_materials using gin (name gin_trgm_ops)
  where deleted_at is null;

create or replace function public.search_customers_for_select(
  p_tenant_id uuid,
  p_q text default '',
  p_limit int default 25
)
returns table (
  id uuid,
  name text,
  email text,
  mobile text,
  billing_name text,
  billing_country text,
  billing_city text,
  billing_postal_code text,
  billing_street text,
  billing_house_number text,
  billing_tax_number text
)
language plpgsql
stable
security definer
set search_path = public
set statement_timeout = '6s'
as $$
declare
  v_q text := trim(both from coalesce(p_q, ''));
  v_limit int := greatest(1, least(coalesce(p_limit, 25), 50));
  v_pattern text;
begin
  if p_tenant_id is null then
    return;
  end if;

  if v_q = '' then
    return query
    select
      c.id,
      c.name,
      c.email,
      c.mobile,
      c.billing_name,
      coalesce(c.billing_country, 'Magyarország'),
      c.billing_city,
      c.billing_postal_code,
      c.billing_street,
      c.billing_house_number,
      c.billing_tax_number
    from public.customers c
    where c.tenant_id = p_tenant_id
      and c.deleted_at is null
    order by c.name asc
    limit v_limit;
    return;
  end if;

  v_pattern := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
  select
    c.id,
    c.name,
    c.email,
    c.mobile,
    c.billing_name,
    coalesce(c.billing_country, 'Magyarország'),
    c.billing_city,
    c.billing_postal_code,
    c.billing_street,
    c.billing_house_number,
    c.billing_tax_number
  from public.customers c
  where c.tenant_id = p_tenant_id
    and c.deleted_at is null
    and (
      c.name ilike v_pattern escape '\'
      or c.billing_name ilike v_pattern escape '\'
      or c.email ilike v_pattern escape '\'
      or c.mobile ilike v_pattern escape '\'
      or c.billing_city ilike v_pattern escape '\'
    )
  order by
    case
      when c.name ilike v_q || '%' escape '\' then 0
      when c.billing_name ilike v_q || '%' escape '\' then 1
      else 2
    end,
    c.name asc
  limit v_limit;
end;
$$;

revoke all on function public.search_customers_for_select(uuid, text, int) from public;
grant execute on function public.search_customers_for_select(uuid, text, int) to authenticated;
grant execute on function public.search_customers_for_select(uuid, text, int) to service_role;

comment on function public.search_customers_for_select is
  'POS/Opti/számla ügyfél typeahead — név, billing_name, email, mobile, city.';

create or replace function public.search_sheet_materials_for_opti(
  p_tenant_id uuid,
  p_q text default '',
  p_limit int default 40
)
returns table (
  id uuid,
  name text,
  length_mm numeric,
  width_mm numeric,
  thickness_mm numeric,
  on_stock boolean,
  image_url text,
  grain_direction boolean,
  rotatable boolean,
  kerf_mm numeric,
  trim_top_mm numeric,
  trim_right_mm numeric,
  trim_bottom_mm numeric,
  trim_left_mm numeric,
  price_net numeric,
  usage_limit numeric,
  waste_multi numeric,
  manufacturer_name text,
  vat_rate_percent numeric
)
language plpgsql
stable
security definer
set search_path = public
set statement_timeout = '8s'
as $$
declare
  v_q text := trim(both from coalesce(p_q, ''));
  v_limit int := greatest(1, least(coalesce(p_limit, 40), 80));
  v_pattern text;
begin
  if p_tenant_id is null then
    return;
  end if;

  if v_q = '' then
    return query
    select
      s.id,
      s.name::text,
      s.length_mm::numeric,
      s.width_mm::numeric,
      s.thickness_mm::numeric,
      s.on_stock,
      s.image_url::text,
      s.grain_direction,
      coalesce(s.rotatable, true)::boolean,
      coalesce(s.kerf_mm, 3)::numeric,
      s.trim_top_mm::numeric,
      s.trim_right_mm::numeric,
      s.trim_bottom_mm::numeric,
      s.trim_left_mm::numeric,
      s.price_net::numeric,
      s.usage_limit::numeric,
      s.waste_multi::numeric,
      coalesce(m.name, 'Ismeretlen')::text,
      coalesce(t.rate_percent, 0)::numeric
    from public.sheet_materials s
    left join public.manufacturers m on m.id = s.manufacturer_id
    left join public.tax_rates t on t.id = s.tax_rate_id
    where s.tenant_id = p_tenant_id
      and s.active = true
      and s.deleted_at is null
    order by s.name asc
    limit v_limit;
    return;
  end if;

  v_pattern := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
  select
    s.id,
    s.name::text,
    s.length_mm::numeric,
    s.width_mm::numeric,
    s.thickness_mm::numeric,
    s.on_stock,
    s.image_url::text,
    s.grain_direction,
    coalesce(s.rotatable, true)::boolean,
    coalesce(s.kerf_mm, 3)::numeric,
    s.trim_top_mm::numeric,
    s.trim_right_mm::numeric,
    s.trim_bottom_mm::numeric,
    s.trim_left_mm::numeric,
    s.price_net::numeric,
    s.usage_limit::numeric,
    s.waste_multi::numeric,
    coalesce(m.name, 'Ismeretlen')::text,
    coalesce(t.rate_percent, 0)::numeric
  from public.sheet_materials s
  left join public.manufacturers m on m.id = s.manufacturer_id
  left join public.tax_rates t on t.id = s.tax_rate_id
  where s.tenant_id = p_tenant_id
    and s.active = true
    and s.deleted_at is null
    and (
      s.name ilike v_pattern escape '\'
      or m.name ilike v_pattern escape '\'
    )
  order by
    case when s.name ilike v_q || '%' escape '\' then 0 else 1 end,
    s.name asc
  limit v_limit;
end;
$$;

revoke all on function public.search_sheet_materials_for_opti(uuid, text, int) from public;
grant execute on function public.search_sheet_materials_for_opti(uuid, text, int) to authenticated;
grant execute on function public.search_sheet_materials_for_opti(uuid, text, int) to service_role;

comment on function public.search_sheet_materials_for_opti is
  'Opti táblás anyag typeahead — név + gyártó; üres q = első N ABC.';
