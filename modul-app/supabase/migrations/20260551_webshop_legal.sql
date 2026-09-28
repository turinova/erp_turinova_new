-- Webshop jogi csomag (doc 41):
-- 1) tenant_webshop_settings: szállítási / fizetési módok + a jogi oldalak bemenetei (webshop modul saját adatai)
-- 2) webshop_legal_versions: a generált jogi dokumentumok közzétett változatai (archívum, rendeléshez köthető)
-- 3) webshop_withdrawals: online elállási nyilatkozatok (45/2014. Korm. r. 22. § (1a)–(1c)) — tartalom nem módosítható

-- ---------------------------------------------------------------------------
-- 1) Bemenetek
-- ---------------------------------------------------------------------------
alter table public.tenant_webshop_settings
  add column if not exists shipping_carriers text[] not null default '{}',
  add column if not exists payment_methods text[] not null default '{}',
  add column if not exists bank_account text,
  add column if not exists transfer_hold_days integer,
  add column if not exists return_shipping_paid_by text not null default 'customer',
  add column if not exists legal_seller_name text,
  add column if not exists legal_postal_code text,
  add column if not exists legal_city text,
  add column if not exists legal_address text,
  add column if not exists legal_email text,
  add column if not exists legal_phone text,
  add column if not exists legal_tax_number text,
  add column if not exists legal_registration_number text,
  add column if not exists legal_vat_id text,
  add column if not exists legal_county text,
  add column if not exists service_address text,
  add column if not exists support_hours text,
  add column if not exists audience text not null default 'consumer',
  add column if not exists made_to_order boolean not null default false,
  add column if not exists mandatory_warranty boolean not null default false,
  add column if not exists newsletter boolean not null default false,
  add column if not exists micro_enterprise boolean not null default true;

alter table public.tenant_webshop_settings
  drop constraint if exists tenant_webshop_settings_legal_chk;
alter table public.tenant_webshop_settings
  add constraint tenant_webshop_settings_legal_chk check (
    return_shipping_paid_by in ('customer', 'seller')
    and audience in ('consumer', 'business')
    and (transfer_hold_days is null or transfer_hold_days between 1 and 30)
    and cardinality(shipping_carriers) <= 20
    and cardinality(payment_methods) <= 10
    and (bank_account is null or char_length(bank_account) <= 80)
    and (legal_seller_name is null or char_length(legal_seller_name) <= 200)
    and (legal_postal_code is null or char_length(legal_postal_code) <= 10)
    and (legal_city is null or char_length(legal_city) <= 100)
    and (legal_address is null or char_length(legal_address) <= 200)
    and (legal_email is null or char_length(legal_email) <= 200)
    and (legal_phone is null or char_length(legal_phone) <= 40)
    and (legal_tax_number is null or char_length(legal_tax_number) <= 20)
    and (legal_registration_number is null or char_length(legal_registration_number) <= 30)
    and (legal_vat_id is null or char_length(legal_vat_id) <= 20)
    and (legal_county is null or char_length(legal_county) <= 40)
    and (service_address is null or char_length(service_address) <= 300)
    and (support_hours is null or char_length(support_hours) <= 160)
  );

-- ---------------------------------------------------------------------------
-- 2) Közzétett változatok
-- ---------------------------------------------------------------------------
create table if not exists public.webshop_legal_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  kind text not null check (char_length(kind) between 2 and 40),
  version integer not null check (version > 0),
  content_hash text not null check (char_length(content_hash) = 64),
  template_version text not null,
  body jsonb not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, kind, version)
);

create index if not exists webshop_legal_versions_latest_idx
  on public.webshop_legal_versions (tenant_id, kind, version desc);

alter table public.webshop_legal_versions enable row level security;

drop policy if exists webshop_legal_versions_select on public.webshop_legal_versions;
create policy webshop_legal_versions_select
  on public.webshop_legal_versions for select to authenticated
  using (public.is_tenant_member(tenant_id));

comment on table public.webshop_legal_versions is
  'Generált jogi dokumentumok (ÁSZF, adatkezelés…) változatai. Új sor csak tartalomváltozáskor; írás service role-lal.';

-- ---------------------------------------------------------------------------
-- 3) Online elállási nyilatkozatok
-- ---------------------------------------------------------------------------
create table if not exists public.webshop_withdrawals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  reference text not null check (char_length(reference) between 4 and 40),
  customer_name text not null check (char_length(customer_name) between 2 and 200),
  customer_email text not null check (char_length(customer_email) between 3 and 200),
  order_reference text not null check (char_length(order_reference) between 1 and 80),
  items text check (items is null or char_length(items) <= 2000),
  comment text check (comment is null or char_length(comment) <= 2000),
  refund_account text check (refund_account is null or char_length(refund_account) <= 80),
  submitted_at timestamptz not null default now(),
  ip_hash text check (ip_hash is null or char_length(ip_hash) = 64),
  user_agent text check (user_agent is null or char_length(user_agent) <= 300),
  receipt_sent_at timestamptz,
  receipt_error text check (receipt_error is null or char_length(receipt_error) <= 500),
  merchant_notified_at timestamptz,
  handled_at timestamptz,
  handled_by uuid references auth.users (id) on delete set null,
  unique (tenant_id, reference)
);

create index if not exists webshop_withdrawals_tenant_idx
  on public.webshop_withdrawals (tenant_id, submitted_at desc);

create index if not exists webshop_withdrawals_open_idx
  on public.webshop_withdrawals (tenant_id, submitted_at desc)
  where handled_at is null;

alter table public.webshop_withdrawals enable row level security;

drop policy if exists webshop_withdrawals_select on public.webshop_withdrawals;
drop policy if exists webshop_withdrawals_update on public.webshop_withdrawals;

create policy webshop_withdrawals_select
  on public.webshop_withdrawals for select to authenticated
  using (public.is_tenant_member(tenant_id));

create policy webshop_withdrawals_update
  on public.webshop_withdrawals for update to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

-- A nyilatkozat tartalma és időpontja bizonyíték: csak a kezelési / kézbesítési mezők változhatnak.
create or replace function public.webshop_withdrawals_guard()
returns trigger
language plpgsql
as $$
begin
  if new.tenant_id is distinct from old.tenant_id
    or new.reference is distinct from old.reference
    or new.customer_name is distinct from old.customer_name
    or new.customer_email is distinct from old.customer_email
    or new.order_reference is distinct from old.order_reference
    or new.items is distinct from old.items
    or new.comment is distinct from old.comment
    or new.refund_account is distinct from old.refund_account
    or new.submitted_at is distinct from old.submitted_at
    or new.ip_hash is distinct from old.ip_hash
    or new.user_agent is distinct from old.user_agent
  then
    raise exception 'Az elállási nyilatkozat tartalma nem módosítható.';
  end if;
  return new;
end;
$$;

drop trigger if exists webshop_withdrawals_guard on public.webshop_withdrawals;
create trigger webshop_withdrawals_guard
  before update on public.webshop_withdrawals
  for each row execute function public.webshop_withdrawals_guard();

comment on table public.webshop_withdrawals is
  'Online elállási nyilatkozatok (bolt /info/elallas). Beküldés service role-lal; tartalom nem módosítható, törlés nincs.';
