-- Bolti kiosk leadás → piszkozat ajánlat (source = 'kiosk')
-- Doc: modul-app/docs/62-bolti-kiosk-pult-workflow.md
-- Ügyfél: telefonszám-egyezés (normalize_hu_phone), különben új ügyfél.

-- ---------------------------------------------------------------------------
-- Telefonszám normalizálás (HU): csak számjegy, `36…` alak
-- ---------------------------------------------------------------------------
create or replace function public.normalize_hu_phone(p text)
returns text
language sql
immutable
parallel safe
as $$
  select case
    when d is null or d = '' then null
    when d like '0036%' then substr(d, 3)
    when d like '06%' then '36' || substr(d, 3)
    when length(d) = 9 and substr(d, 1, 2) in ('20', '30', '31', '50', '70')
      then '36' || d
    else d
  end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) s
$$;

comment on function public.normalize_hu_phone(text) is
  'HU telefonszám → csak számjegy, 36… alak (06…, 0036…, +36…, 9 jegyű mobil). Kiosk ügyfél-egyezéshez.';

create index if not exists customers_tenant_mobile_norm_alive_idx
  on public.customers (tenant_id, public.normalize_hu_phone(mobile))
  where deleted_at is null and mobile is not null;

-- Kiosk submit (service role): élő ügyfelek ugyanazzal a normalizált számmal.
create or replace function public.find_customers_by_phone(
  p_tenant_id uuid,
  p_phone text
)
returns table (
  id uuid,
  name text,
  email text,
  billing_name text,
  billing_city text,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select c.id, c.name, c.email, c.billing_name, c.billing_city, c.updated_at
  from public.customers c
  where c.tenant_id = p_tenant_id
    and c.deleted_at is null
    and c.mobile is not null
    and public.normalize_hu_phone(c.mobile) = public.normalize_hu_phone(p_phone)
    and public.normalize_hu_phone(p_phone) is not null
  order by c.updated_at desc
  limit 10
$$;

revoke all on function public.find_customers_by_phone(uuid, text) from public;
revoke all on function public.find_customers_by_phone(uuid, text) from anon, authenticated;
grant execute on function public.find_customers_by_phone(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- quotes: source = kiosk + kiosk mezők
-- ---------------------------------------------------------------------------
alter table public.quotes
  drop constraint if exists quotes_source_check;

alter table public.quotes
  add constraint quotes_source_check
  check (source in ('opti', 'portal', 'internal', 'kiosk'));

alter table public.quotes
  alter column created_by drop not null;

alter table public.quotes
  drop constraint if exists quotes_created_by_required;

alter table public.quotes
  add constraint quotes_created_by_required
  check (created_by is not null or source = 'kiosk');

alter table public.quotes
  add column if not exists kiosk_submitted_at timestamptz,
  add column if not exists kiosk_device_id uuid
    references public.kiosk_devices (id) on delete set null,
  add column if not exists kiosk_submission_id uuid,
  add column if not exists kiosk_guest_name text,
  add column if not exists kiosk_guest_phone text,
  add column if not exists kiosk_guest_email text,
  add column if not exists kiosk_consent_at timestamptz,
  add column if not exists kiosk_consent_version text,
  add column if not exists kiosk_customer_match text;

alter table public.quotes
  drop constraint if exists quotes_kiosk_customer_match_check;

alter table public.quotes
  add constraint quotes_kiosk_customer_match_check
  check (
    kiosk_customer_match is null
    or kiosk_customer_match in ('phone', 'phone_multiple', 'created', 'created_renamed')
  );

create unique index if not exists quotes_tenant_kiosk_submission_uidx
  on public.quotes (tenant_id, kiosk_submission_id)
  where kiosk_submission_id is not null;

create index if not exists quotes_tenant_kiosk_submitted_idx
  on public.quotes (tenant_id, kiosk_submitted_at desc)
  where source = 'kiosk' and deleted_at is null;

comment on column public.quotes.kiosk_submission_id is
  'Kliens idempotencia kulcs: dupla leadás / retry ugyanazt az ajánlatot adja vissza.';
comment on column public.quotes.kiosk_customer_match is
  'phone = 1 egyezés · phone_multiple = több ügyfél ugyanazzal a számmal · created = új ügyfél · created_renamed = új ügyfél, név foglalt volt.';
