create table public.materials (
  id uuid not null default gen_random_uuid (),
  brand_id uuid null,
  group_id uuid null,
  name character varying not null,
  length_mm integer not null,
  width_mm integer not null,
  thickness_mm integer not null,
  grain_direction boolean null default false,
  image_url text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  on_stock boolean not null default true,
  price_per_sqm numeric(10, 2) not null default 0,
  currency_id uuid null,
  vat_id uuid null,
  active boolean not null default true,
  base_price integer not null,
  multiplier numeric(3, 2) not null default 1.38,
  partners_id uuid null,
  units_id uuid not null,
  constraint materials_pkey primary key (id),
  constraint materials_vat_id_fkey foreign KEY (vat_id) references vat (id),
  constraint materials_currency_id_fkey foreign KEY (currency_id) references currencies (id),
  constraint materials_units_id_fkey foreign KEY (units_id) references units (id) on delete RESTRICT,
  constraint materials_brand_id_fkey foreign KEY (brand_id) references brands (id),
  constraint materials_partners_id_fkey foreign KEY (partners_id) references partners (id) on delete RESTRICT,
  constraint materials_group_id_fkey foreign KEY (group_id) references material_groups (id),
  constraint materials_multiplier_range check (
    (
      (multiplier >= 1.00)
      and (multiplier <= 5.00)
    )
  ),
  constraint materials_base_price_positive check ((base_price > 0))
) TABLESPACE pg_default;

create index IF not exists idx_materials_currency_id on public.materials using btree (currency_id) TABLESPACE pg_default;

create index IF not exists idx_materials_vat_id on public.materials using btree (vat_id) TABLESPACE pg_default;

create index IF not exists ix_materials_deleted_at on public.materials using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is null);

create unique INDEX IF not exists materials_name_unique_active on public.materials using btree (name) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists idx_materials_brand_id on public.materials using btree (brand_id) TABLESPACE pg_default;

create index IF not exists idx_materials_group_id on public.materials using btree (group_id) TABLESPACE pg_default;

create index IF not exists idx_materials_units_id on public.materials using btree (units_id) TABLESPACE pg_default;

create index IF not exists idx_materials_base_price on public.materials using btree (base_price) TABLESPACE pg_default;

create index IF not exists idx_materials_multiplier on public.materials using btree (multiplier) TABLESPACE pg_default;

create index IF not exists idx_materials_partners_id on public.materials using btree (partners_id) TABLESPACE pg_default;

create trigger update_materials_updated_at BEFORE
update on materials for EACH row
execute FUNCTION update_updated_at_column ();

create trigger trigger_calculate_materials_price_per_sqm BEFORE INSERT
or
update on materials for EACH row
execute FUNCTION calculate_materials_price_per_sqm ();

create table public.linear_materials (
  id uuid not null default gen_random_uuid (),
  brand_id uuid not null,
  name character varying(255) not null,
  width numeric(10, 2) not null,
  length numeric(10, 2) not null,
  thickness numeric(10, 2) not null,
  type text not null,
  image_url text null,
  price_per_m numeric(10, 2) not null default 0,
  currency_id uuid null,
  vat_id uuid null,
  on_stock boolean not null default true,
  active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  base_price integer not null,
  multiplier numeric(3, 2) not null default 1.38,
  partners_id uuid null,
  units_id uuid not null,
  constraint linear_materials_pkey primary key (id),
  constraint linear_materials_brand_id_fkey foreign KEY (brand_id) references brands (id) on delete RESTRICT,
  constraint linear_materials_currency_id_fkey foreign KEY (currency_id) references currencies (id) on delete RESTRICT,
  constraint linear_materials_partners_id_fkey foreign KEY (partners_id) references partners (id) on delete RESTRICT,
  constraint linear_materials_vat_id_fkey foreign KEY (vat_id) references vat (id) on delete RESTRICT,
  constraint linear_materials_units_id_fkey foreign KEY (units_id) references units (id) on delete RESTRICT,
  constraint linear_materials_base_price_positive check ((base_price > 0)),
  constraint linear_materials_multiplier_range check (
    (
      (multiplier >= 1.00)
      and (multiplier <= 5.00)
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_linear_materials_active on public.linear_materials using btree (active) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists idx_linear_materials_brand_id on public.linear_materials using btree (brand_id) TABLESPACE pg_default;

create index IF not exists idx_linear_materials_currency_id on public.linear_materials using btree (currency_id) TABLESPACE pg_default;

create index IF not exists idx_linear_materials_deleted_at on public.linear_materials using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists idx_linear_materials_name on public.linear_materials using btree (name) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists idx_linear_materials_on_stock on public.linear_materials using btree (on_stock) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists idx_linear_materials_vat_id on public.linear_materials using btree (vat_id) TABLESPACE pg_default;

create index IF not exists idx_linear_materials_base_price on public.linear_materials using btree (base_price) TABLESPACE pg_default;

create index IF not exists idx_linear_materials_multiplier on public.linear_materials using btree (multiplier) TABLESPACE pg_default;

create index IF not exists idx_linear_materials_partners_id on public.linear_materials using btree (partners_id) TABLESPACE pg_default;

create index IF not exists idx_linear_materials_units_id on public.linear_materials using btree (units_id) TABLESPACE pg_default;

create trigger update_linear_materials_updated_at BEFORE
update on linear_materials for EACH row
execute FUNCTION update_updated_at_column ();

create trigger trigger_calculate_linear_materials_price_per_m BEFORE INSERT
or
update on linear_materials for EACH row
execute FUNCTION calculate_linear_materials_price_per_m ();
create table public.shop_orders (
  id uuid not null default gen_random_uuid (),
  order_number character varying(50) not null,
  worker_id uuid not null,
  customer_name character varying(255) not null,
  customer_email character varying(255) null,
  customer_mobile character varying(50) null,
  customer_discount numeric(5, 2) null default 0,
  billing_name character varying(255) null,
  billing_country character varying(100) null,
  billing_city character varying(100) null,
  billing_postal_code character varying(20) null,
  billing_street character varying(255) null,
  billing_house_number character varying(20) null,
  billing_tax_number character varying(50) null,
  billing_company_reg_number character varying(50) null,
  status character varying(20) null default 'open'::character varying,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  deleted_at timestamp with time zone null,
  sms_sent_at timestamp with time zone null,
  constraint shop_orders_pkey primary key (id),
  constraint shop_orders_order_number_key unique (order_number),
  constraint shop_orders_worker_id_fkey foreign KEY (worker_id) references workers (id),
  constraint shop_orders_status_check check (
    (
      (status)::text = any (
        array[
          ('open'::character varying)::text,
          ('ordered'::character varying)::text,
          ('arrived'::character varying)::text,
          ('finished'::character varying)::text,
          ('handed_over'::character varying)::text,
          ('deleted'::character varying)::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_shop_orders_created_at on public.shop_orders using btree (created_at) TABLESPACE pg_default;

create index IF not exists idx_shop_orders_deleted_at on public.shop_orders using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists idx_shop_orders_order_number on public.shop_orders using btree (order_number) TABLESPACE pg_default;

create index IF not exists idx_shop_orders_worker_id on public.shop_orders using btree (worker_id) TABLESPACE pg_default;

create index IF not exists idx_shop_orders_status on public.shop_orders using btree (status) TABLESPACE pg_default;

create index IF not exists idx_shop_orders_sms_sent_at on public.shop_orders using btree (sms_sent_at) TABLESPACE pg_default
where
  (sms_sent_at is not null);
  create table public.accessories (
  id uuid not null default gen_random_uuid (),
  name character varying(255) not null,
  sku character varying(100) not null,
  net_price integer not null,
  vat_id uuid not null,
  currency_id uuid not null,
  units_id uuid not null,
  partners_id uuid not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  base_price integer not null,
  multiplier numeric(3, 2) null default 1.38,
  constraint accessories_pkey primary key (id),
  constraint accessories_currency_id_fkey foreign KEY (currency_id) references currencies (id) on delete RESTRICT,
  constraint accessories_partners_id_fkey foreign KEY (partners_id) references partners (id) on delete RESTRICT,
  constraint accessories_units_id_fkey foreign KEY (units_id) references units (id) on delete RESTRICT,
  constraint accessories_vat_id_fkey foreign KEY (vat_id) references vat (id) on delete RESTRICT,
  constraint accessories_base_price_positive check ((base_price > 0)),
  constraint accessories_multiplier_range check (
    (
      (multiplier >= 1.00)
      and (multiplier <= 5.00)
    )
  )
) TABLESPACE pg_default;

create unique INDEX IF not exists accessories_sku_unique_active on public.accessories using btree (sku) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists idx_accessories_deleted_at on public.accessories using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists idx_accessories_name_active on public.accessories using btree (name) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists idx_accessories_sku_active on public.accessories using btree (sku) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists idx_accessories_currency_id on public.accessories using btree (currency_id) TABLESPACE pg_default;

create index IF not exists idx_accessories_partners_id on public.accessories using btree (partners_id) TABLESPACE pg_default;

create index IF not exists idx_accessories_units_id on public.accessories using btree (units_id) TABLESPACE pg_default;

create index IF not exists idx_accessories_vat_id on public.accessories using btree (vat_id) TABLESPACE pg_default;

create index IF not exists idx_accessories_base_price on public.accessories using btree (base_price) TABLESPACE pg_default;

create index IF not exists idx_accessories_multiplier on public.accessories using btree (multiplier) TABLESPACE pg_default;

create trigger update_accessories_updated_at BEFORE
update on accessories for EACH row
execute FUNCTION update_accessories_updated_at ();

create trigger trigger_calculate_accessory_net_price BEFORE INSERT
or
update on accessories for EACH row
execute FUNCTION calculate_accessory_net_price ();

create table public.shop_order_items (
  id uuid not null default gen_random_uuid (),
  order_id uuid not null,
  product_name character varying(255) not null,
  sku character varying(100) null,
  type character varying(100) null,
  base_price integer not null,
  multiplier numeric(3, 2) null default 1.38,
  quantity numeric(10, 2) not null,
  units_id uuid null,
  partner_id uuid null,
  vat_id uuid null,
  currency_id uuid null,
  megjegyzes text null,
  status character varying(20) null default 'open'::character varying,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  deleted_at timestamp with time zone null,
  constraint shop_order_items_pkey primary key (id),
  constraint shop_order_items_order_id_fkey foreign KEY (order_id) references shop_orders (id) on delete CASCADE,
  constraint shop_order_items_partner_id_fkey foreign KEY (partner_id) references partners (id),
  constraint shop_order_items_currency_id_fkey foreign KEY (currency_id) references currencies (id),
  constraint shop_order_items_units_id_fkey foreign KEY (units_id) references units (id),
  constraint shop_order_items_vat_id_fkey foreign KEY (vat_id) references vat (id),
  constraint shop_order_items_status_check check (
    (
      (status)::text = any (
        array[
          ('open'::character varying)::text,
          ('ordered'::character varying)::text,
          ('arrived'::character varying)::text,
          ('handed_over'::character varying)::text,
          ('deleted'::character varying)::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_shop_order_items_order_id on public.shop_order_items using btree (order_id) TABLESPACE pg_default;

create index IF not exists idx_shop_order_items_partner_id on public.shop_order_items using btree (partner_id) TABLESPACE pg_default;

create index IF not exists idx_shop_order_items_status on public.shop_order_items using btree (status) TABLESPACE pg_default;

create index IF not exists idx_shop_order_items_deleted_at on public.shop_order_items using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is null);

create trigger trigger_update_shop_order_status
after INSERT
or DELETE
or
update on shop_order_items for EACH row
execute FUNCTION update_shop_order_status ();