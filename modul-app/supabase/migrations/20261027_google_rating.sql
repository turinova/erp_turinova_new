-- Google csillagátlag + értékelésszám (Places API, naponta) + napi pillanatkép
-- Docs: 55-google-cegprofil.md · Előfeltétel: 20261003_tenant_company_google_profile.sql
-- Írás csak service role-lal (cron).

alter table public.tenant_companies
  add column if not exists google_rating numeric(2, 1),
  add column if not exists google_rating_count integer,
  add column if not exists google_rating_fetched_at timestamptz;

comment on column public.tenant_companies.google_rating is
  'Google csillagátlag (Places API, naponta frissítve).';
comment on column public.tenant_companies.google_rating_count is
  'Google értékelések száma (Places API userRatingCount).';

create table if not exists public.google_rating_snapshots (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  ymd date not null,
  rating numeric(2, 1),
  rating_count integer not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, ymd)
);

comment on table public.google_rating_snapshots is
  'Napi Google értékelés pillanatkép — havi / 30 napos változáshoz.';

alter table public.google_rating_snapshots enable row level security;

drop policy if exists google_rating_snapshots_select_member on public.google_rating_snapshots;
create policy google_rating_snapshots_select_member
  on public.google_rating_snapshots for select to authenticated
  using (public.is_tenant_member(tenant_id) or public.is_platform_admin());
