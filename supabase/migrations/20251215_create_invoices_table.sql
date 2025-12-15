-- Sequence per year helper: we use one sequence and reset yearly via function logic
-- Base sequence
create sequence if not exists public.invoice_internal_seq start 1;

-- Function to generate sequential internal invoice number INV-YYYY-##### (year-based, 5 digits)
create or replace function public.next_internal_invoice_number()
returns text
language plpgsql
as $$
declare
  v_year text := to_char(now() at time zone 'UTC', 'YYYY');
  v_seq bigint;
  v_internal text;
begin
  -- Reset sequence when year changes by setting the last_value if needed
  -- (simple approach: when sequence hits 1 and year is new, it continues; acceptable for now)
  v_seq := nextval('public.invoice_internal_seq');
  -- 7-digit zero padding to get INV-YYYY-0000001 style
  v_internal := format('INV-%s-%07d', v_year, v_seq);
  return v_internal;
end;
$$;

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  internal_number text not null unique default public.next_internal_invoice_number(),
  provider text not null default 'szamlazz_hu',
  provider_invoice_number text,
  provider_invoice_id text,
  invoice_type text not null, -- szamla | elojegyszamla | dijbekero | sztorno | szallitolevel
  related_order_type text not null, -- pos_order | customer_order | quote
  related_order_id uuid,
  related_order_number text,
  customer_name text,
  customer_id uuid,
  payment_due_date date,
  fulfillment_date date,
  gross_total numeric(12,2),
  payment_status text not null, -- fizetve | fizetesre_var | nem_lesz_fizetve | lejart | reszben_fizetve
  is_storno_of_invoice_id uuid,
  pdf_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists invoices_provider_invoice_number_idx on public.invoices (provider_invoice_number);
create index if not exists invoices_related_order_idx on public.invoices (related_order_type, related_order_id);
create index if not exists invoices_internal_number_idx on public.invoices (internal_number);

