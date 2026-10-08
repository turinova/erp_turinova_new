-- Összevont számla: több sale / opti_order → egy invoices sor + N:1 linkek

alter table public.invoices
  drop constraint if exists invoices_related_source_type_check;

alter table public.invoices
  add constraint invoices_related_source_type_check
  check (
    related_source_type in (
      'sale',
      'opti_quote',
      'opti_order',
      'manual',
      'consolidated'
    )
  );

create table if not exists public.invoice_source_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  source_type text not null
    check (source_type in ('sale', 'opti_order')),
  source_id uuid not null,
  source_number text,
  created_at timestamptz not null default now(),
  unique (invoice_id, source_type, source_id)
);

-- Egy forrás egyszerre csak egy élő (nem soft-deleted) számlához tartozhat.
create unique index if not exists invoice_source_links_source_uidx
  on public.invoice_source_links (tenant_id, source_type, source_id);

create index if not exists invoice_source_links_invoice_idx
  on public.invoice_source_links (tenant_id, invoice_id);

create index if not exists invoice_source_links_source_lookup_idx
  on public.invoice_source_links (tenant_id, source_type, source_id);

alter table public.invoice_source_links enable row level security;

drop policy if exists invoice_source_links_select_member on public.invoice_source_links;
create policy invoice_source_links_select_member
  on public.invoice_source_links for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists invoice_source_links_insert_writer on public.invoice_source_links;
create policy invoice_source_links_insert_writer
  on public.invoice_source_links for insert to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists invoice_source_links_update_writer on public.invoice_source_links;
create policy invoice_source_links_update_writer
  on public.invoice_source_links for update to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists invoice_source_links_delete_writer on public.invoice_source_links;
create policy invoice_source_links_delete_writer
  on public.invoice_source_links for delete to authenticated
  using (public.can_write_tenant(tenant_id));

comment on table public.invoice_source_links is
  'Összevont számla forrásai (sale / opti_order). Sztornó után a linkek törlődnek.';
