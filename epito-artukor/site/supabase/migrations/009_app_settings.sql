-- =============================================================================
-- Építő Ártükör — Org alkalmazás beállítások (manuálisan futtasd a Supabase SQL Editorban)
-- =============================================================================
-- Előfeltétel: 001_auth_foundation.sql már lefutott
-- Egy sor / szervezet: fedezet %, ajánlat/RFQ alapértékek, dokumentum szövegek
-- =============================================================================

create table if not exists public.organization_app_settings (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  default_trade_markups jsonb not null default '{}'::jsonb,
  min_acceptable_margin_percent int not null default 12
    check (min_acceptable_margin_percent >= 0),
  offer_validity_days int not null default 30
    check (offer_validity_days >= 1),
  rfq_default_validity_days int not null default 14
    check (rfq_default_validity_days >= 1),
  offer_default_notes text not null default '',
  offer_default_payment_terms text not null default '',
  tig_document_prefix text not null default 'TIG',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists organization_app_settings_updated_at on public.organization_app_settings;
create trigger organization_app_settings_updated_at
  before update on public.organization_app_settings
  for each row
  execute function public.set_updated_at();

alter table public.organization_app_settings enable row level security;

drop policy if exists "organization_app_settings_select_member" on public.organization_app_settings;
create policy "organization_app_settings_select_member"
  on public.organization_app_settings for select
  using (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = organization_app_settings.organization_id
        and om.user_id = auth.uid()
    )
  );

drop policy if exists "organization_app_settings_insert_member" on public.organization_app_settings;
create policy "organization_app_settings_insert_member"
  on public.organization_app_settings for insert
  with check (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = organization_app_settings.organization_id
        and om.user_id = auth.uid()
    )
  );

drop policy if exists "organization_app_settings_update_member" on public.organization_app_settings;
create policy "organization_app_settings_update_member"
  on public.organization_app_settings for update
  using (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = organization_app_settings.organization_id
        and om.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = organization_app_settings.organization_id
        and om.user_id = auth.uid()
    )
  );

-- Demo org alapértékek (idempotens)
insert into public.organization_app_settings (
  organization_id,
  default_trade_markups,
  min_acceptable_margin_percent,
  offer_validity_days,
  rfq_default_validity_days,
  offer_default_notes,
  offer_default_payment_terms,
  tig_document_prefix
)
select
  o.id,
  '{
    "epitomester": 18,
    "nyilaszaró": 12,
    "gepeszet": 12,
    "elektromos": 15,
    "riaszto": 15
  }'::jsonb,
  12,
  30,
  14,
  'Az ajánlat a feltüntetett érvényességi időtartamig érvényes. Az árak nettó / bruttó bontásban a csomag pillanatképében szerepelnek.',
  'Fizetési feltétel: 30% előleg szerződéskötéskor, 70% teljesítésigazolás után 8 napon belül.',
  'TIG'
from public.organizations o
where o.slug = 'demo'
on conflict (organization_id) do nothing;
