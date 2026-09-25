-- Webshop B2C add-on: katalógus + kategória/attribútum törzs (doc 39)
-- Nem része az Alap plannak. Platform kapcsolja.

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------
insert into public.product_features (key, label, category, page_key, sort_order, active)
values
  (
    'webshop',
    'Online bolt',
    'Add-on',
    null,
    560,
    true
  ),
  (
    '/webshop',
    'Webshop áttekintés',
    'Webshop',
    '/webshop',
    50,
    true
  ),
  (
    '/webshop/katalogus',
    'Bolt katalógus',
    'Webshop',
    '/webshop/katalogus',
    51,
    true
  ),
  (
    '/webshop/kategoriak',
    'Bolt kategóriák',
    'Webshop',
    '/webshop/kategoriak',
    52,
    true
  ),
  (
    '/webshop/tulajdonsagok',
    'Bolt tulajdonságok',
    'Webshop',
    '/webshop/tulajdonsagok',
    53,
    true
  )
on conflict (key) do update
set
  label = excluded.label,
  category = excluded.category,
  page_key = excluded.page_key,
  sort_order = excluded.sort_order,
  active = true;

insert into public.product_addons (
  key, name, description, active, price_monthly_huf, currency
)
values (
  'webshop',
  'Online bolt',
  'B2C termékoldal + checkout előkészület: bolt kategóriák, tulajdonságok, shop-ready katalógus. PDP / Stripe későbbi fázis.',
  true,
  12900,
  'HUF'
)
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description,
  active = true,
  price_monthly_huf = excluded.price_monthly_huf,
  currency = 'HUF',
  updated_at = now();

insert into public.product_addon_features (addon_id, feature_key)
select a.id, v.feature_key
from public.product_addons a
cross join (
  values
    ('webshop'),
    ('/webshop'),
    ('/webshop/katalogus'),
    ('/webshop/kategoriak'),
    ('/webshop/tulajdonsagok')
) as v(feature_key)
where a.key = 'webshop'
  and exists (select 1 from public.product_features f where f.key = v.feature_key)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Tables: categories
-- ---------------------------------------------------------------------------
create table if not exists public.web_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  parent_id uuid references public.web_categories (id) on delete set null,
  name text not null,
  slug text,
  google_taxonomy_id text,
  sort_order integer not null default 100,
  active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint web_categories_name_len check (char_length(trim(name)) >= 1)
);

create index if not exists web_categories_tenant_alive_idx
  on public.web_categories (tenant_id)
  where deleted_at is null;

create unique index if not exists web_categories_tenant_name_parent_alive_uidx
  on public.web_categories (tenant_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name))
  where deleted_at is null;

comment on table public.web_categories is
  'Webshop add-on: B2C bolt kategória-fa (nem ERP belső kategória).';

-- ---------------------------------------------------------------------------
-- Tables: attributes + values
-- ---------------------------------------------------------------------------
create table if not exists public.product_attributes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  code text not null,
  is_variant_axis boolean not null default false,
  sort_order integer not null default 100,
  active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_attributes_name_len check (char_length(trim(name)) >= 1),
  constraint product_attributes_code_len check (char_length(trim(code)) >= 1)
);

create unique index if not exists product_attributes_tenant_code_alive_uidx
  on public.product_attributes (tenant_id, lower(code))
  where deleted_at is null;

create index if not exists product_attributes_tenant_alive_idx
  on public.product_attributes (tenant_id)
  where deleted_at is null;

create table if not exists public.attribute_values (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  attribute_id uuid not null references public.product_attributes (id) on delete cascade,
  label text not null,
  slug text,
  sort_order integer not null default 100,
  active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attribute_values_label_len check (char_length(trim(label)) >= 1)
);

create unique index if not exists attribute_values_attr_label_alive_uidx
  on public.attribute_values (attribute_id, lower(label))
  where deleted_at is null;

create index if not exists attribute_values_tenant_attr_idx
  on public.attribute_values (tenant_id, attribute_id)
  where deleted_at is null;

comment on table public.product_attributes is
  'Webshop add-on: globális termék tulajdonság (szín, méret, anyag…).';
comment on table public.attribute_values is
  'Webshop add-on: controlled list értékek egy tulajdonsághoz.';

-- ---------------------------------------------------------------------------
-- Accessories FKs
-- ---------------------------------------------------------------------------
alter table public.accessories
  add column if not exists web_category_id uuid
    references public.web_categories (id) on delete set null;

create index if not exists accessories_web_category_idx
  on public.accessories (tenant_id, web_category_id)
  where deleted_at is null and web_category_id is not null;

create table if not exists public.accessory_attribute_values (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  accessory_id uuid not null references public.accessories (id) on delete cascade,
  attribute_value_id uuid not null references public.attribute_values (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (accessory_id, attribute_value_id)
);

create index if not exists accessory_attribute_values_tenant_idx
  on public.accessory_attribute_values (tenant_id, accessory_id);

comment on table public.accessory_attribute_values is
  'Termék ↔ controlled attribute value (szín/méret/anyag…).';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.web_categories enable row level security;
alter table public.product_attributes enable row level security;
alter table public.attribute_values enable row level security;
alter table public.accessory_attribute_values enable row level security;

drop policy if exists web_categories_select on public.web_categories;
create policy web_categories_select
  on public.web_categories for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists web_categories_insert on public.web_categories;
create policy web_categories_insert
  on public.web_categories for insert to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists web_categories_update on public.web_categories;
create policy web_categories_update
  on public.web_categories for update to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists web_categories_delete on public.web_categories;
create policy web_categories_delete
  on public.web_categories for delete to authenticated
  using (public.can_write_tenant(tenant_id));

drop policy if exists product_attributes_select on public.product_attributes;
create policy product_attributes_select
  on public.product_attributes for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists product_attributes_insert on public.product_attributes;
create policy product_attributes_insert
  on public.product_attributes for insert to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists product_attributes_update on public.product_attributes;
create policy product_attributes_update
  on public.product_attributes for update to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists product_attributes_delete on public.product_attributes;
create policy product_attributes_delete
  on public.product_attributes for delete to authenticated
  using (public.can_write_tenant(tenant_id));

drop policy if exists attribute_values_select on public.attribute_values;
create policy attribute_values_select
  on public.attribute_values for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists attribute_values_insert on public.attribute_values;
create policy attribute_values_insert
  on public.attribute_values for insert to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists attribute_values_update on public.attribute_values;
create policy attribute_values_update
  on public.attribute_values for update to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists attribute_values_delete on public.attribute_values;
create policy attribute_values_delete
  on public.attribute_values for delete to authenticated
  using (public.can_write_tenant(tenant_id));

drop policy if exists accessory_attribute_values_select on public.accessory_attribute_values;
create policy accessory_attribute_values_select
  on public.accessory_attribute_values for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists accessory_attribute_values_insert on public.accessory_attribute_values;
create policy accessory_attribute_values_insert
  on public.accessory_attribute_values for insert to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists accessory_attribute_values_delete on public.accessory_attribute_values;
create policy accessory_attribute_values_delete
  on public.accessory_attribute_values for delete to authenticated
  using (public.can_write_tenant(tenant_id));

-- ---------------------------------------------------------------------------
-- Seed defaults on addon enable
-- ---------------------------------------------------------------------------
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
  insert into public.web_categories (tenant_id, name, sort_order)
  select p_tenant_id, v.name, v.sort_order
  from (
    values
      ('Vasalat', 10),
      ('Fogantyú', 20),
      ('Zsanér', 30),
      ('Egyéb', 100)
  ) as v(name, sort_order)
  where not exists (
    select 1 from public.web_categories c
    where c.tenant_id = p_tenant_id
      and c.deleted_at is null
      and lower(c.name) = lower(v.name)
      and c.parent_id is null
  );

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

revoke all on function public.seed_webshop_defaults_for_tenant(uuid) from public;
grant execute on function public.seed_webshop_defaults_for_tenant(uuid) to service_role;
