-- Google cégprofil: értékelő link + saját rövid link (/g/{code}) + kattintásnapló
-- Docs: 55-google-cegprofil.md

alter table public.tenant_companies
  add column if not exists google_review_url text,
  add column if not exists google_place_id text,
  add column if not exists google_review_code text,
  add column if not exists google_profile_updated_at timestamptz;

alter table public.tenant_companies
  drop constraint if exists tenant_companies_google_review_url_chk;
alter table public.tenant_companies
  add constraint tenant_companies_google_review_url_chk
  check (
    google_review_url is null
    or (google_review_url ~* '^https://' and length(google_review_url) <= 500)
  );

alter table public.tenant_companies
  drop constraint if exists tenant_companies_google_review_code_chk;
alter table public.tenant_companies
  add constraint tenant_companies_google_review_code_chk
  check (google_review_code is null or google_review_code ~ '^[A-Za-z0-9]{4,16}$');

create unique index if not exists tenant_companies_google_review_code_uidx
  on public.tenant_companies (google_review_code)
  where google_review_code is not null;

comment on column public.tenant_companies.google_review_url is
  'Google értékelő űrlap linkje (g.page/r/…/review vagy writereview?placeid=…).';
comment on column public.tenant_companies.google_place_id is
  'Google Place ID, ha a linkből kiolvasható.';
comment on column public.tenant_companies.google_review_code is
  'Saját rövid link kódja: /g/{code} → google_review_url. Egyszer generálódik, nem változik.';

-- Kattintásnapló (link-előnézet botok nélkül); írás csak service role-lal (/g route)
create table if not exists public.google_review_link_clicks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  source text not null default 'direct',
  user_agent text,
  clicked_at timestamptz not null default now(),
  constraint google_review_link_clicks_source_chk
    check (source in ('direct', 'sms', 'partner', 'qr', 'email', 'other'))
);

create index if not exists google_review_link_clicks_tenant_clicked_idx
  on public.google_review_link_clicks (tenant_id, clicked_at desc);

comment on table public.google_review_link_clicks is
  'Google értékelő rövid link (/g/{code}) kattintásai — forrás szerint.';

alter table public.google_review_link_clicks enable row level security;

drop policy if exists google_review_link_clicks_select_member
  on public.google_review_link_clicks;
create policy google_review_link_clicks_select_member
  on public.google_review_link_clicks
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id) or public.is_platform_admin());
