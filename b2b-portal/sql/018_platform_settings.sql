-- Platform-szintű operátori beállítások (egy sor)
create table if not exists public.platform_settings (
  id integer primary key default 1 check (id = 1),
  trial_days integer not null default 30
    check (trial_days >= 1 and trial_days <= 90),
  sync_concurrency integer not null default 10
    check (sync_concurrency >= 1 and sync_concurrency <= 50),
  portal_top_n_gate boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.platform_settings (id)
values (1)
on conflict (id) do nothing;

insert into public.schema_migrations (filename)
values ('018_platform_settings.sql')
on conflict (filename) do nothing;
