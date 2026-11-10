-- Google értékelés kérése: beállítások, vevői hozzájárulás, státusz oldal kattintás, köszönő SMS sor
-- Docs: 55-google-cegprofil.md · Előfeltétel: 20261003_tenant_company_google_profile.sql

-- 1) Tenant beállítások (egy sor / tenant)
create table if not exists public.tenant_review_settings (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  status_page_enabled boolean not null default true,
  handover_qr_enabled boolean not null default false,
  handover_qr_text text not null default 'Értékelj minket a Google-ön — 30 mp',
  thank_sms_enabled boolean not null default false,
  thank_sms_timing text not null default 'next_morning',
  frequency_days integer not null default 180,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  constraint tenant_review_settings_timing_chk
    check (thank_sms_timing in ('after_2h', 'next_morning')),
  constraint tenant_review_settings_frequency_chk
    check (frequency_days in (90, 180, 365)),
  constraint tenant_review_settings_qr_text_chk
    check (char_length(handover_qr_text) between 1 and 80)
);

comment on table public.tenant_review_settings is
  'Google értékelés kérése: státusz oldal, átvételi blokk QR, köszönő SMS, gyakoriság.';

alter table public.tenant_review_settings enable row level security;

drop policy if exists tenant_review_settings_select_member on public.tenant_review_settings;
create policy tenant_review_settings_select_member
  on public.tenant_review_settings for select to authenticated
  using (public.is_tenant_member(tenant_id) or public.is_platform_admin());

drop policy if exists tenant_review_settings_insert_writer on public.tenant_review_settings;
create policy tenant_review_settings_insert_writer
  on public.tenant_review_settings for insert to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists tenant_review_settings_update_writer on public.tenant_review_settings;
create policy tenant_review_settings_update_writer
  on public.tenant_review_settings for update to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

-- 2) Vevő: külön hozzájárulás az értékelés-kérő SMS-hez + gyakoriság-korlát
alter table public.customers
  add column if not exists review_sms_consent boolean not null default false,
  add column if not exists review_sms_consent_at timestamptz,
  add column if not exists last_review_request_at timestamptz;

comment on column public.customers.review_sms_consent is
  'Hozzájárult az értékelés-kérő (köszönő) SMS-hez. Külön a tranzakciós sms_notification-tól.';
comment on column public.customers.last_review_request_at is
  'Utolsó értékelés-kérés (köszönő SMS) — gyakoriság-korláthoz.';

-- 3) Kattintásnapló: melyik státusz linkről / melyik vevőtől
alter table public.google_review_link_clicks
  add column if not exists share_link_id uuid
    references public.order_share_links (id) on delete set null,
  add column if not exists customer_id uuid
    references public.customers (id) on delete set null;

alter table public.google_review_link_clicks
  drop constraint if exists google_review_link_clicks_source_chk;
alter table public.google_review_link_clicks
  add constraint google_review_link_clicks_source_chk
  check (source in ('direct', 'sms', 'partner', 'qr', 'email', 'status', 'other'));

create index if not exists google_review_link_clicks_customer_idx
  on public.google_review_link_clicks (tenant_id, customer_id, clicked_at desc)
  where customer_id is not null;

create index if not exists google_review_link_clicks_share_idx
  on public.google_review_link_clicks (share_link_id)
  where share_link_id is not null;

-- 4) SMS sablon + napló kulcs
alter table public.tenant_sms_templates
  drop constraint if exists tenant_sms_templates_key_check;
alter table public.tenant_sms_templates
  add constraint tenant_sms_templates_key_check
  check (template_key in ('quote_ready', 'cso_ready', 'review_thanks'));

alter table public.sms_send_events
  drop constraint if exists sms_send_events_template_check;
alter table public.sms_send_events
  add constraint sms_send_events_template_check
  check (template_key in ('quote_ready', 'cso_ready', 'review_thanks'));

-- 5) Köszönő SMS ütemezési sor (átadáskor kerül be, cron küldi)
create table if not exists public.review_request_queue (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  quote_id uuid references public.quotes (id) on delete cascade,
  customer_special_order_id uuid
    references public.customer_special_orders (id) on delete cascade,
  handed_over_at timestamptz not null default now(),
  send_after timestamptz not null,
  status text not null default 'pending',
  skip_reason text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  constraint review_request_queue_status_chk
    check (status in ('pending', 'sent', 'skipped', 'failed')),
  constraint review_request_queue_ref_chk
    check (quote_id is not null or customer_special_order_id is not null)
);

create unique index if not exists review_request_queue_quote_uidx
  on public.review_request_queue (quote_id) where quote_id is not null;
create unique index if not exists review_request_queue_cso_uidx
  on public.review_request_queue (customer_special_order_id)
  where customer_special_order_id is not null;
create index if not exists review_request_queue_due_idx
  on public.review_request_queue (send_after) where status = 'pending';
create index if not exists review_request_queue_tenant_idx
  on public.review_request_queue (tenant_id, created_at desc);

comment on table public.review_request_queue is
  'Köszönő SMS (Google értékelés kérés) ütemezés — /api/cron/review-sms dolgozza fel.';

alter table public.review_request_queue enable row level security;

drop policy if exists review_request_queue_select_member on public.review_request_queue;
create policy review_request_queue_select_member
  on public.review_request_queue for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists review_request_queue_insert_writer on public.review_request_queue;
create policy review_request_queue_insert_writer
  on public.review_request_queue for insert to authenticated
  with check (public.can_write_tenant(tenant_id));
