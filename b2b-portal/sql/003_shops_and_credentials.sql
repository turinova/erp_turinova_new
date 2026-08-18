-- =============================================================================
-- b2b-portal / 003_shops_and_credentials.sql
-- Shops, encrypted credentials, CORS origins
-- MANUÁLISAN futtasd — előtte: 001, 002
-- =============================================================================

-- -----------------------------------------------------------------------------
-- shops
-- -----------------------------------------------------------------------------
create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations (id) on delete cascade,
  shoprenter_shop_name text not null,
  store_url text,
  public_id text not null default encode(gen_random_bytes(16), 'hex'),
  status text not null default 'draft'
    check (status in (
      'draft',
      'active',
      'needs_reauth',
      'suspended',
      'uninstalled'
    )),
  widget_enabled boolean not null default false,
  last_ping_at timestamptz,
  last_ping_ok boolean,
  last_ping_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shops_shoprenter_name_unique unique (shoprenter_shop_name),
  constraint shops_public_id_unique unique (public_id)
);

create index if not exists idx_shops_org
  on public.shops (organization_id);
create index if not exists idx_shops_status
  on public.shops (status);
create index if not exists idx_shops_org_status
  on public.shops (organization_id, status);

drop trigger if exists trg_shops_updated_at on public.shops;
create trigger trg_shops_updated_at
  before update on public.shops
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- shop_credentials (1:1, secrets encrypted at rest)
-- -----------------------------------------------------------------------------
create table if not exists public.shop_credentials (
  shop_id uuid primary key
    references public.shops (id) on delete cascade,
  auth_type text not null default 'oauth'
    check (auth_type in ('oauth', 'basic_legacy')),
  -- AES-256-GCM payload (app encrypts JSON: clientId/secret or user/pass)
  ciphertext bytea not null,
  iv bytea not null,
  key_version int not null default 1,
  token_expires_at timestamptz,
  rotated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_shop_credentials_updated_at on public.shop_credentials;
create trigger trg_shop_credentials_updated_at
  before update on public.shop_credentials
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- shop_allowed_origins (widget CORS)
-- -----------------------------------------------------------------------------
create table if not exists public.shop_allowed_origins (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null
    references public.shops (id) on delete cascade,
  origin text not null,
  created_at timestamptz not null default now(),
  constraint shop_allowed_origins_unique unique (shop_id, origin)
);

create index if not exists idx_shop_allowed_origins_shop
  on public.shop_allowed_origins (shop_id);

insert into public.schema_migrations (filename)
values ('003_shops_and_credentials.sql')
on conflict (filename) do nothing;
