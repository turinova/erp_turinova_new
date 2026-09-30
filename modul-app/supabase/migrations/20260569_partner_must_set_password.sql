-- Partner migráció: első belépéskor kötelező jelszó-beállítás + legacy audit

alter table public.partner_profiles
  add column if not exists must_set_password boolean not null default false;

alter table public.partner_profiles
  add column if not exists legacy_portal_customer_id uuid;

comment on column public.partner_profiles.must_set_password is
  'true = migrált / nincs ismert jelszó — login UX: jelszó-beállítás';

comment on column public.partner_profiles.legacy_portal_customer_id is
  'customer-portal portal_customers.id (audit / idempotencia)';

create unique index if not exists partner_profiles_legacy_portal_customer_uidx
  on public.partner_profiles (legacy_portal_customer_id)
  where legacy_portal_customer_id is not null;
