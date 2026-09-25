-- Ne seedeljük a Szín/Méret/Anyag VIP hármast — műszaki adatokat a tenant adja hozzá.
-- Meglévő seed soft-delete (értékek + termék linkek tisztítva).

create or replace function public.seed_webshop_defaults_for_tenant(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
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

  -- product_attributes: nincs default seed (szín/méret/anyag sem)
end;
$$;

-- Soft-delete seedelt color / size / material + értékeik + termék linkek
with doomed as (
  select id, tenant_id
  from public.product_attributes
  where deleted_at is null
    and lower(code) in ('color', 'size', 'material')
),
value_ids as (
  select v.id, v.tenant_id
  from public.attribute_values v
  inner join doomed d on d.id = v.attribute_id
  where v.deleted_at is null
)
delete from public.accessory_attribute_values aav
using value_ids v
where aav.attribute_value_id = v.id
  and aav.tenant_id = v.tenant_id;

update public.attribute_values v
set
  deleted_at = now(),
  active = false,
  updated_at = now()
from public.product_attributes a
where v.attribute_id = a.id
  and v.deleted_at is null
  and a.deleted_at is null
  and lower(a.code) in ('color', 'size', 'material');

update public.product_attributes
set
  deleted_at = now(),
  active = false,
  updated_at = now()
where deleted_at is null
  and lower(code) in ('color', 'size', 'material');
