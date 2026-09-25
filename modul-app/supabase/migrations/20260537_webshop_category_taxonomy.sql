-- Webshop kategóriák: seed Google taxonomy ID + meglévő seed sorok backfill

create or replace function public.seed_webshop_defaults_for_tenant(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_color_id uuid;
  v_size_id uuid;
  v_material_id uuid;
begin
  insert into public.web_categories (tenant_id, name, sort_order, google_taxonomy_id)
  select p_tenant_id, v.name, v.sort_order, v.google_taxonomy_id
  from (
    values
      ('Vasalat', 10, '4696'),
      ('Fogantyú', 20, '4700'),
      ('Zsanér', 30, '1771'),
      ('Fiókcsúszó', 40, '8470'),
      ('Egyéb', 100, '4696')
  ) as v(name, sort_order, google_taxonomy_id)
  where not exists (
    select 1 from public.web_categories c
    where c.tenant_id = p_tenant_id
      and c.deleted_at is null
      and lower(c.name) = lower(v.name)
      and c.parent_id is null
  );

  -- Már létező seed nevek: üres taxonomy kitöltése
  update public.web_categories c
  set
    google_taxonomy_id = v.google_taxonomy_id,
    updated_at = now()
  from (
    values
      ('Vasalat', '4696'),
      ('Fogantyú', '4700'),
      ('Zsanér', '1771'),
      ('Fiókcsúszó', '8470'),
      ('Egyéb', '4696')
  ) as v(name, google_taxonomy_id)
  where c.tenant_id = p_tenant_id
    and c.deleted_at is null
    and c.parent_id is null
    and lower(c.name) = lower(v.name)
    and (c.google_taxonomy_id is null or btrim(c.google_taxonomy_id) = '');

  insert into public.product_attributes (tenant_id, name, code, sort_order)
  select p_tenant_id, v.name, v.code, v.sort_order
  from (
    values
      ('Szín', 'color', 10),
      ('Méret', 'size', 20),
      ('Anyag', 'material', 30)
  ) as v(name, code, sort_order)
  where not exists (
    select 1 from public.product_attributes a
    where a.tenant_id = p_tenant_id
      and a.deleted_at is null
      and lower(a.code) = lower(v.code)
  );

  select id into v_color_id from public.product_attributes
  where tenant_id = p_tenant_id and deleted_at is null and lower(code) = 'color'
  limit 1;
  select id into v_size_id from public.product_attributes
  where tenant_id = p_tenant_id and deleted_at is null and lower(code) = 'size'
  limit 1;
  select id into v_material_id from public.product_attributes
  where tenant_id = p_tenant_id and deleted_at is null and lower(code) = 'material'
  limit 1;

  if v_color_id is not null then
    insert into public.attribute_values (tenant_id, attribute_id, label, sort_order)
    select p_tenant_id, v_color_id, v.label, v.sort_order
    from (
      values ('Fehér', 10), ('Fekete', 20), ('Ezüst', 30), ('Barna', 40)
    ) as v(label, sort_order)
    where not exists (
      select 1 from public.attribute_values x
      where x.attribute_id = v_color_id and x.deleted_at is null and lower(x.label) = lower(v.label)
    );
  end if;

  if v_size_id is not null then
    insert into public.attribute_values (tenant_id, attribute_id, label, sort_order)
    select p_tenant_id, v_size_id, v.label, v.sort_order
    from (
      values ('110°', 10), ('170°', 20), ('Standard', 30)
    ) as v(label, sort_order)
    where not exists (
      select 1 from public.attribute_values x
      where x.attribute_id = v_size_id and x.deleted_at is null and lower(x.label) = lower(v.label)
    );
  end if;

  if v_material_id is not null then
    insert into public.attribute_values (tenant_id, attribute_id, label, sort_order)
    select p_tenant_id, v_material_id, v.label, v.sort_order
    from (
      values ('Acél', 10), ('Zamak', 20), ('Műanyag', 30)
    ) as v(label, sort_order)
    where not exists (
      select 1 from public.attribute_values x
      where x.attribute_id = v_material_id and x.deleted_at is null and lower(x.label) = lower(v.label)
    );
  end if;
end;
$$;

-- Backfill: minden tenant, ahol a seed nevek üres taxonomy-val vannak
update public.web_categories c
set
  google_taxonomy_id = v.google_taxonomy_id,
  updated_at = now()
from (
  values
    ('Vasalat', '4696'),
    ('Fogantyú', '4700'),
    ('Zsanér', '1771'),
    ('Fiókcsúszó', '8470'),
    ('Egyéb', '4696')
) as v(name, google_taxonomy_id)
where c.deleted_at is null
  and c.parent_id is null
  and lower(c.name) = lower(v.name)
  and (c.google_taxonomy_id is null or btrim(c.google_taxonomy_id) = '');

-- Fiókcsúszó seed azoknál a tenantoknál, ahol már van web_categories
insert into public.web_categories (tenant_id, name, sort_order, google_taxonomy_id)
select distinct c.tenant_id, 'Fiókcsúszó', 40, '8470'
from public.web_categories c
where c.deleted_at is null
  and not exists (
    select 1
    from public.web_categories x
    where x.tenant_id = c.tenant_id
      and x.deleted_at is null
      and x.parent_id is null
      and lower(x.name) = lower('Fiókcsúszó')
  );
