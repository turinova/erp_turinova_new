create table public.customers (
  id uuid not null default gen_random_uuid (),
  name character varying not null,
  email character varying not null,
  mobile character varying null,
  discount_percent numeric(5, 2) null default 0,
  billing_name character varying null,
  billing_country character varying null default 'Magyarország'::character varying,
  billing_city character varying null,
  billing_postal_code character varying null,
  billing_street character varying null,
  billing_house_number character varying null,
  billing_tax_number character varying null,
  billing_company_reg_number character varying null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  sms_notification boolean not null default false,
  constraint customers_pkey primary key (id),
  constraint customers_email_key unique (email)
) TABLESPACE pg_default;

create unique INDEX IF not exists customers_name_unique_active on public.customers using btree (name) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists idx_customers_active_ordered on public.customers using btree (deleted_at, name) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists idx_customers_email_active on public.customers using btree (email) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists idx_customers_name_active on public.customers using btree (name) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists ix_customers_deleted_at on public.customers using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists idx_customers_sms_notification on public.customers using btree (sms_notification) TABLESPACE pg_default
where
  (deleted_at is null);

create trigger update_customers_updated_at BEFORE
update on customers for EACH row
execute FUNCTION update_updated_at_column ();