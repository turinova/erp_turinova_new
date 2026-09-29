-- Manuális / önálló számla forrás (sale / opti nélkül)

alter table public.invoices
  drop constraint if exists invoices_related_source_type_check;

alter table public.invoices
  add constraint invoices_related_source_type_check
  check (
    related_source_type in (
      'sale',
      'opti_quote',
      'opti_order',
      'manual'
    )
  );
