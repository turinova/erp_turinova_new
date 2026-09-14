-- modul-app: per-tenant feature overrides (plan/addon felett)
-- effective = (plan ∪ addons) − override false ∪ override true
-- /home mindig kötelező; „Alkalmaz plan” nem törli az override-okat.

create table if not exists public.tenant_feature_overrides (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  feature_key text not null references public.product_features (key) on delete cascade,
  enabled boolean not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  primary key (tenant_id, feature_key)
);

create index if not exists tenant_feature_overrides_feature_idx
  on public.tenant_feature_overrides (feature_key);

alter table public.tenant_feature_overrides enable row level security;

drop policy if exists tenant_feature_overrides_select on public.tenant_feature_overrides;
create policy tenant_feature_overrides_select
  on public.tenant_feature_overrides
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id) or public.is_platform_admin());

comment on table public.tenant_feature_overrides is
  'Per-tenant feature ki/be a plan+add-on alap fölött. enabled=false = kikapcsolva, true = force be.';
