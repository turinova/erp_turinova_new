-- Bolt katalógus: tömeges tagság gyártó szerint (Live ki).
-- Előnézet + set-based insert; slug a Live / szerkesztéskor jön (storefront amúgy is szűr null slugot).

create index if not exists accessories_tenant_manufacturer_alive_idx
  on public.accessories (tenant_id, manufacturer_id)
  where deleted_at is null;

comment on index public.accessories_tenant_manufacturer_alive_idx is
  'Gyártó szerinti bolt-hozzáadás / szűrés: tenant + manufacturer, élő sorok.';

-- ---------------------------------------------------------------------------
-- Előnézet: darabszámok + minta nevek
-- ---------------------------------------------------------------------------
create or replace function public.webshop_add_preview(
  p_tenant uuid,
  p_manufacturer_id uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
set statement_timeout = '8s'
as $$
declare
  v_name text;
  v_total int;
  v_in_shop int;
  v_to_add int;
  v_inactive int;
  v_sample text[];
begin
  if not public.is_tenant_member(p_tenant) then
    raise exception 'Nincs jogosultság.' using errcode = '42501';
  end if;

  select m.name
  into v_name
  from public.manufacturers m
  where m.id = p_manufacturer_id
    and m.tenant_id = p_tenant
    and m.deleted_at is null;

  if v_name is null then
    raise exception 'A gyártó nem található.' using errcode = 'P0002';
  end if;

  select
    count(*) filter (where a.active)::int,
    count(*) filter (where a.active and w.accessory_id is not null)::int,
    count(*) filter (where a.active and w.accessory_id is null)::int,
    count(*) filter (where not a.active)::int
  into v_total, v_in_shop, v_to_add, v_inactive
  from public.accessories a
  left join public.accessory_web w on w.accessory_id = a.id
  where a.tenant_id = p_tenant
    and a.manufacturer_id = p_manufacturer_id
    and a.deleted_at is null;

  select array_agg(x.name order by x.ord)
  into v_sample
  from (
    select a.name, row_number() over (order by a.name, a.id) as ord
    from public.accessories a
    where a.tenant_id = p_tenant
      and a.manufacturer_id = p_manufacturer_id
      and a.deleted_at is null
      and a.active
      and not exists (
        select 1 from public.accessory_web w where w.accessory_id = a.id
      )
    order by a.name, a.id
    limit 5
  ) x;

  return jsonb_build_object(
    'manufacturer_id', p_manufacturer_id,
    'manufacturer_name', v_name,
    'total', coalesce(v_total, 0),
    'in_shop', coalesce(v_in_shop, 0),
    'to_add', coalesce(v_to_add, 0),
    'inactive', coalesce(v_inactive, 0),
    'sample', to_jsonb(coalesce(v_sample, array[]::text[]))
  );
end;
$$;

revoke all on function public.webshop_add_preview(uuid, uuid) from public;
grant execute on function public.webshop_add_preview(uuid, uuid) to authenticated;

comment on function public.webshop_add_preview(uuid, uuid) is
  'Bolt: gyártó szerinti tömeges hozzáadás előnézete (darabszámok + minta).';

-- ---------------------------------------------------------------------------
-- Hozzáadás: max p_limit (≤5000) aktív, még nem bolt-tag termék
-- ---------------------------------------------------------------------------
create or replace function public.webshop_add_by_manufacturer(
  p_tenant uuid,
  p_manufacturer_id uuid,
  p_limit int default 2000
)
returns jsonb
language plpgsql
security invoker
set search_path = public
set statement_timeout = '15s'
as $$
declare
  v_limit int;
  v_added int := 0;
  v_remaining int := 0;
begin
  if not public.can_write_tenant(p_tenant) then
    raise exception 'Nincs jogosultság.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.manufacturers m
    where m.id = p_manufacturer_id
      and m.tenant_id = p_tenant
      and m.deleted_at is null
  ) then
    raise exception 'A gyártó nem található.' using errcode = 'P0002';
  end if;

  v_limit := greatest(1, least(coalesce(nullif(p_limit, 0), 2000), 5000));

  with candidates as (
    select a.id
    from public.accessories a
    where a.tenant_id = p_tenant
      and a.manufacturer_id = p_manufacturer_id
      and a.deleted_at is null
      and a.active
      and not exists (
        select 1 from public.accessory_web w where w.accessory_id = a.id
      )
    order by a.name, a.id
    limit v_limit
  ),
  inserted as (
    insert into public.accessory_web (accessory_id, tenant_id, sellable_web)
    select c.id, p_tenant, false
    from candidates c
    on conflict (accessory_id) do nothing
    returning accessory_id
  )
  select count(*)::int into v_added from inserted;

  select count(*)::int
  into v_remaining
  from public.accessories a
  where a.tenant_id = p_tenant
    and a.manufacturer_id = p_manufacturer_id
    and a.deleted_at is null
    and a.active
    and not exists (
      select 1 from public.accessory_web w where w.accessory_id = a.id
    );

  return jsonb_build_object(
    'added', coalesce(v_added, 0),
    'remaining', coalesce(v_remaining, 0)
  );
end;
$$;

revoke all on function public.webshop_add_by_manufacturer(uuid, uuid, int) from public;
grant execute on function public.webshop_add_by_manufacturer(uuid, uuid, int) to authenticated;

comment on function public.webshop_add_by_manufacturer(uuid, uuid, int) is
  'Bolt: gyártó aktív ERP termékeinek tagsága (sellable_web=false). Idempotens.';
