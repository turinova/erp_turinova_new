-- Update internal invoice numbering to 6-digit padding (INV-YYYY-000001)
-- Keeps existing sequence but changes formatting; default is reaffirmed to use the generator

create or replace function public.next_internal_invoice_number()
returns text
language plpgsql
as $$
declare
  v_year text := to_char(now() at time zone 'UTC', 'YYYY');
  v_seq bigint;
  v_internal text;
begin
  v_seq := nextval('public.invoice_internal_seq');
  -- 6-digit zero padding: INV-YYYY-000001 (use lpad because format() has no %d specifier)
  v_internal := format('INV-%s-%s', v_year, lpad(v_seq::text, 6, '0'));
  return v_internal;
end;
$$;

alter table public.invoices
  alter column internal_number set default public.next_internal_invoice_number();


