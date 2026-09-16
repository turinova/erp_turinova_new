-- Quote ready SMS add-on: templates, opt-in, ledger, ready_notification_sent_at

-- ---------------------------------------------------------------------------
-- Add-on + features
-- ---------------------------------------------------------------------------
insert into public.product_features (key, label, category, page_key, sort_order, active)
values (
  'quote_ready_sms',
  'Készre jelentés SMS',
  'Add-on',
  null,
  520,
  true
)
on conflict (key) do update
set
  label = excluded.label,
  category = excluded.category,
  page_key = excluded.page_key,
  sort_order = excluded.sort_order,
  active = true;

insert into public.product_features (key, label, category, page_key, sort_order, active)
values (
  '/beallitasok/sms',
  'SMS sablon',
  'Beállítások',
  '/beallitasok/sms',
  176,
  true
)
on conflict (key) do update
set
  label = excluded.label,
  category = excluded.category,
  page_key = excluded.page_key,
  sort_order = excluded.sort_order,
  active = true;

insert into public.product_addons (key, name, description, active)
values (
  'quote_ready_sms',
  'Készre jelentés SMS',
  'Ügyfél SMS a megrendelés készre állításakor (platform Twilio + usage ledger).',
  true
)
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description,
  active = true,
  updated_at = now();

insert into public.product_addon_features (addon_id, feature_key)
select a.id, f.key
from public.product_addons a
cross join (values ('quote_ready_sms'), ('/beallitasok/sms')) as f(key)
where a.key = 'quote_ready_sms'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- customers.sms_notification
-- ---------------------------------------------------------------------------
alter table public.customers
  add column if not exists sms_notification boolean not null default false;

comment on column public.customers.sms_notification is
  'Opt-in: készre jelentés SMS küldhető az ügyfélnek.';

-- ---------------------------------------------------------------------------
-- quotes.ready_notification_sent_at
-- ---------------------------------------------------------------------------
alter table public.quotes
  add column if not exists ready_notification_sent_at timestamptz;

comment on column public.quotes.ready_notification_sent_at is
  'Sikeres készre jelentés SMS időpontja (dupla küldés tiltva).';

-- ---------------------------------------------------------------------------
-- tenant_sms_templates
-- ---------------------------------------------------------------------------
create table if not exists public.tenant_sms_templates (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  template_key text not null,
  body text not null,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, template_key),
  constraint tenant_sms_templates_key_check
    check (template_key in ('quote_ready')),
  constraint tenant_sms_templates_body_len
    check (char_length(body) between 1 and 600)
);

comment on table public.tenant_sms_templates is
  'Tenant SMS sablonok (quote_ready stb.).';

alter table public.tenant_sms_templates enable row level security;

drop policy if exists tenant_sms_templates_select_member
  on public.tenant_sms_templates;
create policy tenant_sms_templates_select_member
  on public.tenant_sms_templates
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists tenant_sms_templates_insert_writer
  on public.tenant_sms_templates;
create policy tenant_sms_templates_insert_writer
  on public.tenant_sms_templates
  for insert
  to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists tenant_sms_templates_update_writer
  on public.tenant_sms_templates;
create policy tenant_sms_templates_update_writer
  on public.tenant_sms_templates
  for update
  to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

-- ---------------------------------------------------------------------------
-- sms_send_events (billing ledger)
-- ---------------------------------------------------------------------------
create table if not exists public.sms_send_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  quote_id uuid references public.quotes (id) on delete set null,
  customer_id uuid references public.customers (id) on delete set null,
  template_key text not null,
  to_e164 text,
  body_length integer not null default 0,
  segments integer not null default 0,
  provider text not null default 'twilio',
  provider_sid text,
  status text not null,
  error_code text,
  skip_reason text,
  created_at timestamptz not null default now(),
  created_by uuid,
  constraint sms_send_events_status_check
    check (status in ('sent', 'delivered', 'failed', 'skipped')),
  constraint sms_send_events_template_check
    check (template_key in ('quote_ready'))
);

comment on table public.sms_send_events is
  'SMS usage ledger — számlázás: status in (sent, delivered).';

create index if not exists sms_send_events_tenant_created_idx
  on public.sms_send_events (tenant_id, created_at desc);

create index if not exists sms_send_events_tenant_billable_idx
  on public.sms_send_events (tenant_id, created_at)
  where status in ('sent', 'delivered');

alter table public.sms_send_events enable row level security;

drop policy if exists sms_send_events_select_member
  on public.sms_send_events;
create policy sms_send_events_select_member
  on public.sms_send_events
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists sms_send_events_insert_writer
  on public.sms_send_events;
create policy sms_send_events_insert_writer
  on public.sms_send_events
  for insert
  to authenticated
  with check (public.can_write_tenant(tenant_id));
