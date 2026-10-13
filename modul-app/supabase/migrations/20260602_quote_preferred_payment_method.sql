-- Partner beküldés: választott fizetési mód + comment snapshot (szándék ≠ befizetés).
-- Docs: 20-partner-portal.md

alter table public.quotes
  add column if not exists preferred_payment_method_id uuid
    references public.payment_methods (id) on delete set null,
  add column if not exists preferred_payment_method_name text,
  add column if not exists preferred_payment_method_comment text;

comment on column public.quotes.preferred_payment_method_id is
  'Partner / portal által választott fizetési mód (szándék).';
comment on column public.quotes.preferred_payment_method_name is
  'Beküldéskori fizetési mód név snapshot.';
comment on column public.quotes.preferred_payment_method_comment is
  'Beküldéskori fizetési mód comment snapshot (tenant-specifikus utasítás).';

-- Partner: olvashatja a kapcsolt cég aktív fizetési módjait (+ comment)
drop policy if exists payment_methods_select_partner_catalog
  on public.payment_methods;
create policy payment_methods_select_partner_catalog
  on public.payment_methods
  for select
  to authenticated
  using (
    deleted_at is null
    and active = true
    and public.partner_can_read_tenant_catalog(tenant_id)
  );
