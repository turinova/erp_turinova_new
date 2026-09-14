-- modul-app: seat limit + single active app session / user

alter table public.tenants
  add column if not exists max_seats integer;

comment on column public.tenants.max_seats is
  'Max tagság (felhasználó) a tenantben. NULL = korlátlan.';

-- Meglévő cégek: legyen korlát, de ne zárjon ki azonnal
update public.tenants
set max_seats = 10
where max_seats is null;

alter table public.tenants
  alter column max_seats set default 10;

-- Egy aktív app-session / user (új belépés felülírja)
create table if not exists public.app_user_sessions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  session_nonce text not null,
  tenant_id uuid references public.tenants (id) on delete set null,
  user_agent text,
  ip text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists app_user_sessions_tenant_idx
  on public.app_user_sessions (tenant_id);

alter table public.app_user_sessions enable row level security;

drop policy if exists app_user_sessions_select_own on public.app_user_sessions;
create policy app_user_sessions_select_own
  on public.app_user_sessions
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_platform_admin());

drop policy if exists app_user_sessions_upsert_own on public.app_user_sessions;
create policy app_user_sessions_upsert_own
  on public.app_user_sessions
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists app_user_sessions_update_own on public.app_user_sessions;
create policy app_user_sessions_update_own
  on public.app_user_sessions
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists app_user_sessions_delete_own on public.app_user_sessions;
create policy app_user_sessions_delete_own
  on public.app_user_sessions
  for delete
  to authenticated
  using (user_id = auth.uid() or public.is_platform_admin());

comment on table public.app_user_sessions is
  'Egy aktív munkamenet / user. Új login felülírja — régi böngésző kilép.';
