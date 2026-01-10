-- Ensure internal_number uses the sequential generator with zero padding
alter table public.invoices
  alter column internal_number set default public.next_internal_invoice_number();


