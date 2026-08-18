-- =============================================================================
-- b2b-portal / 004_widget_settings.sql
-- MANUÁLISAN futtasd — előtte: 001–003
-- =============================================================================

create table if not exists public.widget_settings (
  shop_id uuid primary key
    references public.shops (id) on delete cascade,
  button_label text not null default 'Gyors rendelés',
  -- Shoprenter vevőcsoport ID-k (üres = nincs szűrés / későbbi policy)
  customer_group_ids integer[] not null default '{}',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_widget_settings_updated_at on public.widget_settings;
create trigger trg_widget_settings_updated_at
  before update on public.widget_settings
  for each row execute function public.set_updated_at();

insert into public.schema_migrations (filename)
values ('004_widget_settings.sql')
on conflict (filename) do nothing;
