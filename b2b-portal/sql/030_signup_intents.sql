-- =============================================================================
-- b2b-portal / 030_signup_intents.sql
-- MANUÁLISAN futtasd — az app NEM futtat DDL-t.
-- Self-serve próba: email verify → csak utána org/shop/user provision.
-- Előtte: 002, 003, 006 (RLS minták).
-- =============================================================================

create table if not exists public.signup_intents (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  company_name text not null,
  shoprenter_shop_name text not null,
  store_url text,
  password_hash text not null,
  token_hash text not null,
  status text not null default 'pending'
    check (status in ('pending', 'provisioned', 'expired', 'revoked')),
  expires_at timestamptz not null,
  provisioned_at timestamptz,
  provisioned_organization_id uuid
    references public.organizations (id) on delete set null,
  ip text,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint signup_intents_email_lowercase check (email = lower(email)),
  constraint signup_intents_shop_lowercase check (
    shoprenter_shop_name = lower(shoprenter_shop_name)
  ),
  constraint signup_intents_token_hash_unique unique (token_hash)
);

create index if not exists idx_signup_intents_email
  on public.signup_intents (email);

create index if not exists idx_signup_intents_status_expires
  on public.signup_intents (status, expires_at);

-- Egy aktív (pending) intent / email
create unique index if not exists idx_signup_intents_one_pending_email
  on public.signup_intents (email)
  where status = 'pending';

-- Egy aktív pending shop name
create unique index if not exists idx_signup_intents_one_pending_shop
  on public.signup_intents (shoprenter_shop_name)
  where status = 'pending';

alter table public.organizations
  add column if not exists signup_source text
    check (signup_source is null or signup_source in ('admin', 'self_serve'));

alter table public.organizations
  add column if not exists purge_protected boolean not null default false;

comment on column public.organizations.signup_source is
  'admin = platform create; self_serve = /signup flow';
comment on column public.organizations.purge_protected is
  'true = trial purge cron skips this org (support / demo)';

grant select, insert, update, delete on public.signup_intents
  to b2b_app, b2b_admin;

alter table public.signup_intents enable row level security;
alter table public.signup_intents force row level security;

drop policy if exists signup_intents_admin on public.signup_intents;
create policy signup_intents_admin on public.signup_intents
  for all
  using (public.is_b2b_admin())
  with check (public.is_b2b_admin());

insert into schema_migrations (filename) values ('030_signup_intents.sql')
on conflict do nothing;
