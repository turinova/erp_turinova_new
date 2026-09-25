-- 20260541 — Kategóriánkénti kulcsadatok („Passzol-e?”)
-- 1) product_attributes: érték típus (lista / szám / tartomány / igen-nem), mértékegység, mérési tipp
-- 2) accessory_attribute_inputs: nem listás értékek (szám, tartomány, igen-nem)
-- 3) web_category_attributes: kategória sablon (key = kártya, spec = ajánlott adat)
-- 4) web_categories.measure_image_url: kategória szintű „Hogyan mérd le?” ábra
-- 5) Takarítás: a szállítási alapértékből másolt termékméretek nullázása

-- ---------------------------------------------------------------------------
-- 1) Attribútum típus
-- ---------------------------------------------------------------------------
alter table public.product_attributes
  add column if not exists value_type text not null default 'list',
  add column if not exists unit text,
  add column if not exists measure_hint text,
  add column if not exists allow_multiple boolean not null default false;

alter table public.product_attributes
  drop constraint if exists product_attributes_value_type_chk;
alter table public.product_attributes
  add constraint product_attributes_value_type_chk
  check (value_type in ('list', 'number', 'range', 'boolean'));

alter table public.product_attributes
  drop constraint if exists product_attributes_unit_len;
alter table public.product_attributes
  add constraint product_attributes_unit_len
  check (unit is null or char_length(unit) between 1 and 12);

alter table public.product_attributes
  drop constraint if exists product_attributes_hint_len;
alter table public.product_attributes
  add constraint product_attributes_hint_len
  check (measure_hint is null or char_length(measure_hint) <= 300);

comment on column public.product_attributes.value_type is
  'list = controlled értéklista; number = szám; range = min–max; boolean = igen/nem.';
comment on column public.product_attributes.unit is
  'Rögzített mértékegység (mm, kg, °…). Nincs átváltás.';

-- ---------------------------------------------------------------------------
-- 2) Nem listás értékek
-- ---------------------------------------------------------------------------
create table if not exists public.accessory_attribute_inputs (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  accessory_id uuid not null references public.accessories (id) on delete cascade,
  attribute_id uuid not null references public.product_attributes (id) on delete cascade,
  value_num numeric,
  value_max numeric,
  value_bool boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (accessory_id, attribute_id),
  constraint accessory_attribute_inputs_range_chk
    check (value_max is null or value_num is null or value_max >= value_num),
  constraint accessory_attribute_inputs_nonempty_chk
    check (value_num is not null or value_max is not null or value_bool is not null)
);

create index if not exists accessory_attribute_inputs_tenant_idx
  on public.accessory_attribute_inputs (tenant_id, accessory_id);
create index if not exists accessory_attribute_inputs_attr_idx
  on public.accessory_attribute_inputs (tenant_id, attribute_id);

comment on table public.accessory_attribute_inputs is
  'Termék műszaki adat — szám / tartomány / igen-nem érték (lista: accessory_attribute_values).';

-- ---------------------------------------------------------------------------
-- 3) Kategória sablon
-- ---------------------------------------------------------------------------
create table if not exists public.web_category_attributes (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  category_id uuid not null references public.web_categories (id) on delete cascade,
  attribute_id uuid not null references public.product_attributes (id) on delete cascade,
  role text not null default 'key',
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  primary key (category_id, attribute_id),
  constraint web_category_attributes_role_chk check (role in ('key', 'spec'))
);

create index if not exists web_category_attributes_tenant_idx
  on public.web_category_attributes (tenant_id, category_id);

comment on table public.web_category_attributes is
  'Kategória kulcsadat sablon. key (max 4) = „Passzol-e?” kártya; spec = ajánlott adat. Üres = szülőtől örököl.';

-- ---------------------------------------------------------------------------
-- 4) Mérési ábra
-- ---------------------------------------------------------------------------
alter table public.web_categories
  add column if not exists measure_image_url text;

alter table public.web_categories
  drop constraint if exists web_categories_measure_image_len;
alter table public.web_categories
  add constraint web_categories_measure_image_len
  check (measure_image_url is null or char_length(measure_image_url) <= 2000);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.accessory_attribute_inputs enable row level security;
alter table public.web_category_attributes enable row level security;

drop policy if exists accessory_attribute_inputs_select on public.accessory_attribute_inputs;
create policy accessory_attribute_inputs_select
  on public.accessory_attribute_inputs for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists accessory_attribute_inputs_insert on public.accessory_attribute_inputs;
create policy accessory_attribute_inputs_insert
  on public.accessory_attribute_inputs for insert to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists accessory_attribute_inputs_update on public.accessory_attribute_inputs;
create policy accessory_attribute_inputs_update
  on public.accessory_attribute_inputs for update to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists accessory_attribute_inputs_delete on public.accessory_attribute_inputs;
create policy accessory_attribute_inputs_delete
  on public.accessory_attribute_inputs for delete to authenticated
  using (public.can_write_tenant(tenant_id));

drop policy if exists web_category_attributes_select on public.web_category_attributes;
create policy web_category_attributes_select
  on public.web_category_attributes for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists web_category_attributes_insert on public.web_category_attributes;
create policy web_category_attributes_insert
  on public.web_category_attributes for insert to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists web_category_attributes_update on public.web_category_attributes;
create policy web_category_attributes_update
  on public.web_category_attributes for update to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists web_category_attributes_delete on public.web_category_attributes;
create policy web_category_attributes_delete
  on public.web_category_attributes for delete to authenticated
  using (public.can_write_tenant(tenant_id));

grant select, insert, update, delete on public.accessory_attribute_inputs to authenticated;
grant select, insert, update, delete on public.web_category_attributes to authenticated;
grant all on public.accessory_attribute_inputs to service_role;
grant all on public.web_category_attributes to service_role;

-- ---------------------------------------------------------------------------
-- 5) Takarítás: szállítási alapértékből másolt termékméret
--    (enrich korábban product_* = shipping_* / tenant default volt)
-- ---------------------------------------------------------------------------
update public.accessories a
set
  product_weight_kg = null,
  product_length_cm = null,
  product_width_cm = null,
  product_height_cm = null,
  updated_at = now()
where a.deleted_at is null
  and a.product_weight_kg is not null
  and (
    (
      a.product_weight_kg is not distinct from a.shipping_weight_kg
      and a.product_length_cm is not distinct from a.shipping_length_cm
      and a.product_width_cm is not distinct from a.shipping_width_cm
      and a.product_height_cm is not distinct from a.shipping_height_cm
    )
    or (
      a.product_weight_kg = 0.25
      and a.product_length_cm = 20
      and a.product_width_cm = 12
      and a.product_height_cm = 6
    )
    or exists (
      select 1
      from public.tenant_webshop_settings s
      where s.tenant_id = a.tenant_id
        and a.product_weight_kg = s.default_shipping_weight_kg
        and a.product_length_cm = s.default_shipping_length_cm
        and a.product_width_cm = s.default_shipping_width_cm
        and a.product_height_cm = s.default_shipping_height_cm
    )
  );
