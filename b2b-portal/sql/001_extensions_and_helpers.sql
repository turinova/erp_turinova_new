-- =============================================================================
-- b2b-portal / 001_extensions_and_helpers.sql
-- MANUÁLISAN futtasd (Supabase SQL Editor vagy psql)
-- =============================================================================

create extension if not exists "pgcrypto";

-- Nyilvántartás: mely SQL fájlok futottak már
create table if not exists public.schema_migrations (
  filename text primary key,
  applied_at timestamptz not null default now()
);

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

insert into public.schema_migrations (filename)
values ('001_extensions_and_helpers.sql')
on conflict (filename) do nothing;
