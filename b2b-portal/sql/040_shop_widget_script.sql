-- =============================================================================
-- b2b-portal / 040_shop_widget_script.sql
-- MANUÁLISAN futtasd — előtte: 003
-- Widget storefront script telepítés (ScriptTag API / manuális) állapot
-- =============================================================================

alter table public.shops
  add column if not exists widget_script_method text,
  add column if not exists widget_script_tag_id text,
  add column if not exists widget_script_installed_at timestamptz,
  add column if not exists widget_script_verified_at timestamptz;

alter table public.shops
  drop constraint if exists shops_widget_script_method_check;

alter table public.shops
  add constraint shops_widget_script_method_check
  check (
    widget_script_method is null
    or widget_script_method in ('manual', 'script_tag', 'stub')
  );

insert into public.schema_migrations (filename)
values ('040_shop_widget_script.sql')
on conflict (filename) do nothing;
