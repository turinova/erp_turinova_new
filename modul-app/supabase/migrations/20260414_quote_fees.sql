-- Quote fees (díj / jóváírás snapshot) — külön a cutting_fees / szabás díjtól.

alter table public.quotes
  add column if not exists fees_total_net numeric(14, 2) not null default 0,
  add column if not exists fees_total_vat numeric(14, 2) not null default 0,
  add column if not exists fees_total_gross numeric(14, 2) not null default 0,
  add column if not exists final_total_gross numeric(14, 2);

-- Backfill: végösszeg = lapszabászat (díj nélkül eddig)
update public.quotes
set final_total_gross = total_gross
where final_total_gross is null;

alter table public.quotes
  alter column final_total_gross set default 0,
  alter column final_total_gross set not null;

comment on column public.quotes.fees_total_gross is 'Egyéb díjak + jóváírások előjeles bruttó összege';
comment on column public.quotes.final_total_gross is 'Lapszabászat total_gross + fees_total_gross (≥ 0)';

create table if not exists public.quote_fees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  quote_id uuid not null references public.quotes (id) on delete cascade,
  fee_type_id uuid references public.fee_types (id),
  kind text not null default 'fee'
    check (kind in ('fee', 'credit')),
  fee_name text not null,
  quantity integer not null check (quantity >= 1),
  unit_price_net numeric(12, 2) not null,
  tax_rate_percent numeric(5, 2) not null check (tax_rate_percent >= 0),
  vat_amount numeric(14, 2) not null,
  gross_price numeric(14, 2) not null,
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists quote_fees_quote_alive_idx
  on public.quote_fees (quote_id)
  where deleted_at is null;

create index if not exists quote_fees_tenant_alive_idx
  on public.quote_fees (tenant_id)
  where deleted_at is null;

alter table public.quote_fees enable row level security;

drop policy if exists quote_fees_select_member on public.quote_fees;
create policy quote_fees_select_member
  on public.quote_fees
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists quote_fees_insert_writer on public.quote_fees;
create policy quote_fees_insert_writer
  on public.quote_fees
  for insert
  to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists quote_fees_update_writer on public.quote_fees;
create policy quote_fees_update_writer
  on public.quote_fees
  for update
  to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists quote_fees_delete_writer on public.quote_fees;
create policy quote_fees_delete_writer
  on public.quote_fees
  for delete
  to authenticated
  using (public.can_write_tenant(tenant_id));

-- Partner olvashatja saját ajánlata díjsorait (PDF / detail)
drop policy if exists quote_fees_select_partner on public.quote_fees;
create policy quote_fees_select_partner
  on public.quote_fees
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.quotes q
      where q.id = quote_id
        and q.partner_profile_id = auth.uid()
        and q.deleted_at is null
    )
  );

comment on table public.quote_fees is 'Ajánlat egyéb díj / jóváírás sorok (snapshot); nem szabás díj';
comment on column public.quote_fees.kind is 'fee = díj (+), credit = jóváírás (−)';
comment on column public.quote_fees.unit_price_net is 'Előjeles nettó egységár (credit negatív)';
comment on column public.quote_fees.gross_price is 'Előjeles sor bruttó összesen';
