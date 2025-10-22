create table public.quotes (
  id uuid not null default gen_random_uuid (),
  customer_id uuid not null,
  quote_number character varying(50) not null,
  status public.quote_status not null default 'draft'::quote_status,
  total_net numeric(12, 2) not null,
  total_vat numeric(12, 2) not null,
  total_gross numeric(12, 2) not null,
  discount_percent numeric(5, 2) not null default 0,
  final_total_after_discount numeric(12, 2) not null,
  created_by uuid not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  fees_total_net numeric(12, 2) null default 0,
  fees_total_vat numeric(12, 2) null default 0,
  fees_total_gross numeric(12, 2) null default 0,
  accessories_total_net numeric(12, 2) null default 0,
  accessories_total_vat numeric(12, 2) null default 0,
  accessories_total_gross numeric(12, 2) null default 0,
  order_number text null,
  barcode text null,
  production_machine_id uuid null,
  production_date date null,
  payment_status text null default 'not_paid'::text,
  constraint quotes_pkey primary key (id),
  constraint quotes_order_number_key unique (order_number),
  constraint quotes_barcode_key unique (barcode),
  constraint quotes_quote_number_key unique (quote_number),
  constraint quotes_created_by_fkey foreign KEY (created_by) references auth.users (id) on delete RESTRICT,
  constraint quotes_customer_id_fkey foreign KEY (customer_id) references customers (id) on delete RESTRICT,
  constraint quotes_production_machine_id_fkey foreign KEY (production_machine_id) references production_machines (id) on delete RESTRICT
) TABLESPACE pg_default;

create index IF not exists idx_quotes_created_at on public.quotes using btree (created_at desc) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists idx_quotes_created_by on public.quotes using btree (created_by) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists idx_quotes_customer_id on public.quotes using btree (customer_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists idx_quotes_quote_number on public.quotes using btree (quote_number) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists idx_quotes_status on public.quotes using btree (status) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists idx_quotes_order_number on public.quotes using btree (order_number) TABLESPACE pg_default
where
  (order_number is not null);

create index IF not exists idx_quotes_barcode on public.quotes using btree (barcode) TABLESPACE pg_default
where
  (barcode is not null);

create index IF not exists idx_quotes_production_machine on public.quotes using btree (production_machine_id) TABLESPACE pg_default
where
  (production_machine_id is not null);

create index IF not exists idx_quotes_production_date on public.quotes using btree (production_date) TABLESPACE pg_default
where
  (production_date is not null);

create index IF not exists idx_quotes_payment_status on public.quotes using btree (payment_status) TABLESPACE pg_default;

create index IF not exists idx_quotes_status_ordered on public.quotes using btree (status) TABLESPACE pg_default
where
  (
    status = any (
      array[
        'ordered'::quote_status,
        'in_production'::quote_status,
        'ready'::quote_status,
        'finished'::quote_status
      ]
    )
  );

create trigger update_quotes_updated_at BEFORE
update on quotes for EACH row
execute FUNCTION update_updated_at_column ();

create table public.quote_services_breakdown (
  id uuid not null default gen_random_uuid (),
  quote_materials_pricing_id uuid not null,
  service_type character varying(50) not null,
  quantity numeric(10, 2) not null,
  unit_price numeric(10, 2) not null,
  net_price numeric(12, 2) not null,
  vat_amount numeric(12, 2) not null,
  gross_price numeric(12, 2) not null,
  created_at timestamp with time zone not null default now(),
  constraint quote_services_breakdown_pkey primary key (id),
  constraint quote_services_breakdown_quote_materials_pricing_id_fkey foreign KEY (quote_materials_pricing_id) references quote_materials_pricing (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_qsb_pricing_id on public.quote_services_breakdown using btree (quote_materials_pricing_id) TABLESPACE pg_default;

create index IF not exists idx_qsb_service_type on public.quote_services_breakdown using btree (service_type) TABLESPACE pg_default;

create index IF not exists idx_quote_services_breakdown_pricing_id on public.quote_services_breakdown using btree (quote_materials_pricing_id) TABLESPACE pg_default;

create table public.quote_payments (
  id uuid not null default gen_random_uuid (),
  quote_id uuid not null,
  amount numeric(10, 2) not null,
  payment_method text not null,
  comment text null,
  payment_date timestamp without time zone not null default now(),
  created_at timestamp without time zone not null default now(),
  created_by uuid null,
  deleted_at timestamp without time zone null,
  constraint order_payments_pkey primary key (id),
  constraint order_payments_created_by_fkey foreign KEY (created_by) references auth.users (id),
  constraint quote_payments_quote_id_fkey foreign KEY (quote_id) references quotes (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_order_payments_order_id on public.quote_payments using btree (quote_id) TABLESPACE pg_default;

create index IF not exists idx_order_payments_payment_date on public.quote_payments using btree (payment_date desc) TABLESPACE pg_default;

create index IF not exists idx_order_payments_deleted_at on public.quote_payments using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists idx_quote_payments_quote_id on public.quote_payments using btree (quote_id) TABLESPACE pg_default;

create index IF not exists idx_quote_payments_payment_date on public.quote_payments using btree (payment_date desc) TABLESPACE pg_default;

create trigger trigger_update_payment_status_insert
after INSERT on quote_payments for EACH row
execute FUNCTION update_quote_payment_status ();

create trigger trigger_update_payment_status_update
after
update on quote_payments for EACH row
execute FUNCTION update_quote_payment_status ();

create trigger trigger_update_payment_status_delete
after DELETE on quote_payments for EACH row
execute FUNCTION update_quote_payment_status ();

create table public.quote_panels (
  id uuid not null default gen_random_uuid (),
  quote_id uuid not null,
  material_id uuid not null,
  width_mm integer not null,
  height_mm integer not null,
  quantity integer not null,
  label character varying(255) null,
  edge_material_a_id uuid null,
  edge_material_b_id uuid null,
  edge_material_c_id uuid null,
  edge_material_d_id uuid null,
  panthelyfuras_quantity integer not null default 0,
  panthelyfuras_oldal character varying(50) null,
  duplungolas boolean not null default false,
  szogvagas boolean not null default false,
  created_at timestamp with time zone not null default now(),
  constraint quote_panels_pkey primary key (id),
  constraint quote_panels_edge_material_b_id_fkey foreign KEY (edge_material_b_id) references edge_materials (id) on delete RESTRICT,
  constraint quote_panels_edge_material_c_id_fkey foreign KEY (edge_material_c_id) references edge_materials (id) on delete RESTRICT,
  constraint quote_panels_edge_material_a_id_fkey foreign KEY (edge_material_a_id) references edge_materials (id) on delete RESTRICT,
  constraint quote_panels_material_id_fkey foreign KEY (material_id) references materials (id) on delete RESTRICT,
  constraint quote_panels_quote_id_fkey foreign KEY (quote_id) references quotes (id) on delete CASCADE,
  constraint quote_panels_edge_material_d_id_fkey foreign KEY (edge_material_d_id) references edge_materials (id) on delete RESTRICT
) TABLESPACE pg_default;

create index IF not exists idx_quote_panels_edge_material_d_id on public.quote_panels using btree (edge_material_d_id) TABLESPACE pg_default;

create index IF not exists idx_quote_panels_material_id on public.quote_panels using btree (material_id) TABLESPACE pg_default;

create index IF not exists idx_quote_panels_quote_id on public.quote_panels using btree (quote_id) TABLESPACE pg_default;

create index IF not exists idx_quote_panels_edge_material_c_id on public.quote_panels using btree (edge_material_c_id) TABLESPACE pg_default;

create index IF not exists idx_quote_panels_edge_material_a_id on public.quote_panels using btree (edge_material_a_id) TABLESPACE pg_default;

create index IF not exists idx_quote_panels_edge_material_b_id on public.quote_panels using btree (edge_material_b_id) TABLESPACE pg_default;

create table public.quote_materials_pricing (
  id uuid not null default gen_random_uuid (),
  quote_id uuid not null,
  material_id uuid not null,
  material_name character varying(255) not null,
  board_width_mm integer not null,
  board_length_mm integer not null,
  thickness_mm integer not null,
  grain_direction boolean not null,
  on_stock boolean not null,
  boards_used integer not null,
  usage_percentage numeric(5, 2) not null,
  pricing_method character varying(20) not null,
  charged_sqm numeric(10, 4) null,
  price_per_sqm numeric(10, 2) not null,
  vat_rate numeric(5, 4) not null,
  currency character varying(10) not null,
  usage_limit numeric(5, 4) not null,
  waste_multi numeric(5, 2) not null,
  material_net numeric(12, 2) not null,
  material_vat numeric(12, 2) not null,
  material_gross numeric(12, 2) not null,
  edge_materials_net numeric(12, 2) not null default 0,
  edge_materials_vat numeric(12, 2) not null default 0,
  edge_materials_gross numeric(12, 2) not null default 0,
  cutting_length_m numeric(10, 2) not null,
  cutting_net numeric(12, 2) not null default 0,
  cutting_vat numeric(12, 2) not null default 0,
  cutting_gross numeric(12, 2) not null default 0,
  services_net numeric(12, 2) not null default 0,
  services_vat numeric(12, 2) not null default 0,
  services_gross numeric(12, 2) not null default 0,
  total_net numeric(12, 2) not null,
  total_vat numeric(12, 2) not null,
  total_gross numeric(12, 2) not null,
  created_at timestamp with time zone not null default now(),
  constraint quote_materials_pricing_pkey primary key (id),
  constraint quote_materials_pricing_material_id_fkey foreign KEY (material_id) references materials (id) on delete RESTRICT,
  constraint quote_materials_pricing_quote_id_fkey foreign KEY (quote_id) references quotes (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_qmp_material_id on public.quote_materials_pricing using btree (material_id) TABLESPACE pg_default;

create index IF not exists idx_qmp_quote_id on public.quote_materials_pricing using btree (quote_id) TABLESPACE pg_default;

create index IF not exists idx_quote_materials_pricing_quote_id on public.quote_materials_pricing using btree (quote_id) TABLESPACE pg_default;

create table public.quote_fees (
  id uuid not null default gen_random_uuid (),
  quote_id uuid not null,
  feetype_id uuid not null,
  fee_name character varying(255) not null,
  unit_price_net numeric(12, 2) not null,
  vat_rate numeric(5, 4) not null,
  vat_amount numeric(12, 2) not null,
  gross_price numeric(12, 2) not null,
  currency_id uuid not null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  deleted_at timestamp with time zone null,
  quantity integer not null default 1,
  comment text null,
  constraint quote_fees_pkey primary key (id),
  constraint quote_fees_currency_id_fkey foreign KEY (currency_id) references currencies (id),
  constraint quote_fees_feetype_id_fkey foreign KEY (feetype_id) references feetypes (id) on delete RESTRICT,
  constraint quote_fees_quote_id_fkey foreign KEY (quote_id) references quotes (id) on delete CASCADE,
  constraint quote_fees_quantity_check check ((quantity > 0))
) TABLESPACE pg_default;

create index IF not exists idx_quote_fees_quote_id on public.quote_fees using btree (quote_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists idx_quote_fees_deleted_at on public.quote_fees using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists idx_quote_fees_feetype_id on public.quote_fees using btree (feetype_id) TABLESPACE pg_default;

create index IF not exists idx_quote_fees_currency_id on public.quote_fees using btree (currency_id) TABLESPACE pg_default;

create trigger update_quote_fees_updated_at BEFORE
update on quote_fees for EACH row
execute FUNCTION update_quote_fees_updated_at ();

create table public.quote_edge_materials_breakdown (
  id uuid not null default gen_random_uuid (),
  quote_materials_pricing_id uuid not null,
  edge_material_id uuid not null,
  edge_material_name character varying(255) not null,
  total_length_m numeric(10, 2) not null,
  price_per_m numeric(10, 2) not null,
  net_price numeric(12, 2) not null,
  vat_amount numeric(12, 2) not null,
  gross_price numeric(12, 2) not null,
  created_at timestamp with time zone not null default now(),
  constraint quote_edge_materials_breakdown_pkey primary key (id),
  constraint quote_edge_materials_breakdown_edge_material_id_fkey foreign KEY (edge_material_id) references edge_materials (id) on delete RESTRICT,
  constraint quote_edge_materials_breakdown_quote_materials_pricing_id_fkey foreign KEY (quote_materials_pricing_id) references quote_materials_pricing (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_qemb_edge_material_id on public.quote_edge_materials_breakdown using btree (edge_material_id) TABLESPACE pg_default;

create index IF not exists idx_qemb_pricing_id on public.quote_edge_materials_breakdown using btree (quote_materials_pricing_id) TABLESPACE pg_default;

create index IF not exists idx_quote_edge_materials_breakdown_pricing_id on public.quote_edge_materials_breakdown using btree (quote_materials_pricing_id) TABLESPACE pg_default;

create table public.quote_accessories (
  id uuid not null default gen_random_uuid (),
  quote_id uuid not null,
  accessory_id uuid not null,
  quantity integer not null default 1,
  accessory_name character varying(255) not null,
  sku character varying(255) not null,
  unit_price_net numeric(12, 2) not null,
  vat_rate numeric(5, 4) not null,
  unit_id uuid not null,
  unit_name character varying(100) not null,
  currency_id uuid not null,
  total_net numeric(12, 2) not null,
  total_vat numeric(12, 2) not null,
  total_gross numeric(12, 2) not null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  deleted_at timestamp with time zone null,
  base_price integer not null,
  multiplier numeric(3, 2) not null default 1.38,
  constraint quote_accessories_pkey primary key (id),
  constraint quote_accessories_accessory_id_fkey foreign KEY (accessory_id) references accessories (id) on delete RESTRICT,
  constraint quote_accessories_currency_id_fkey foreign KEY (currency_id) references currencies (id),
  constraint quote_accessories_unit_id_fkey foreign KEY (unit_id) references units (id),
  constraint quote_accessories_quote_id_fkey foreign KEY (quote_id) references quotes (id) on delete CASCADE,
  constraint quote_accessories_quantity_check check ((quantity > 0)),
  constraint chk_quote_accessories_base_price_positive check ((base_price >= 0)),
  constraint chk_quote_accessories_multiplier_range check (
    (
      (multiplier >= 1.00)
      and (multiplier <= 5.00)
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_quote_accessories_quote_id on public.quote_accessories using btree (quote_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists idx_quote_accessories_deleted_at on public.quote_accessories using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists idx_quote_accessories_accessory_id on public.quote_accessories using btree (accessory_id) TABLESPACE pg_default;

create index IF not exists idx_quote_accessories_currency_id on public.quote_accessories using btree (currency_id) TABLESPACE pg_default;

create index IF not exists idx_quote_accessories_unit_id on public.quote_accessories using btree (unit_id) TABLESPACE pg_default;

create trigger update_quote_accessories_updated_at BEFORE
update on quote_accessories for EACH row
execute FUNCTION update_quote_accessories_updated_at ();