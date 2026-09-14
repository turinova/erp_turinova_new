-- modul-app: oldal-hozzáférés tagságonként (igen/nem)
-- Futtasd a tenancy foundation után.

-- ---------------------------------------------------------------------------
-- can_manage_users: owner / admin
-- ---------------------------------------------------------------------------
create or replace function public.can_manage_users(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_memberships m
    where m.tenant_id = p_tenant_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  );
$$;

revoke all on function public.can_manage_users(uuid) from public;
grant execute on function public.can_manage_users(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- tenant_membership_page_access
-- ---------------------------------------------------------------------------
create table if not exists public.tenant_membership_page_access (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  membership_id uuid not null references public.tenant_memberships (id) on delete cascade,
  page_key text not null,
  can_access boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_membership_page_access_unique
    unique (membership_id, page_key)
);

create index if not exists tenant_membership_page_access_tenant_idx
  on public.tenant_membership_page_access (tenant_id);

create index if not exists tenant_membership_page_access_membership_idx
  on public.tenant_membership_page_access (membership_id);

alter table public.tenant_membership_page_access enable row level security;

drop policy if exists page_access_select on public.tenant_membership_page_access;
create policy page_access_select
  on public.tenant_membership_page_access
  for select
  to authenticated
  using (
    public.can_manage_users(tenant_id)
    or exists (
      select 1
      from public.tenant_memberships m
      where m.id = membership_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists page_access_insert on public.tenant_membership_page_access;
create policy page_access_insert
  on public.tenant_membership_page_access
  for insert
  to authenticated
  with check (public.can_manage_users(tenant_id));

drop policy if exists page_access_update on public.tenant_membership_page_access;
create policy page_access_update
  on public.tenant_membership_page_access
  for update
  to authenticated
  using (public.can_manage_users(tenant_id))
  with check (public.can_manage_users(tenant_id));

drop policy if exists page_access_delete on public.tenant_membership_page_access;
create policy page_access_delete
  on public.tenant_membership_page_access
  for delete
  to authenticated
  using (public.can_manage_users(tenant_id));

comment on table public.tenant_membership_page_access is
  'Oldaljog tagságonként: page_key = nav path, can_access igen/nem.';

-- ---------------------------------------------------------------------------
-- Membership: tenant manager láthatja a cég tagjait
-- ---------------------------------------------------------------------------
drop policy if exists memberships_select_tenant_manager on public.tenant_memberships;
create policy memberships_select_tenant_manager
  on public.tenant_memberships
  for select
  to authenticated
  using (public.can_manage_users(tenant_id));

-- Membership: manager frissíthet szerepet (nem self-serve create V1-ben a user clienten)
drop policy if exists memberships_update_manager on public.tenant_memberships;
create policy memberships_update_manager
  on public.tenant_memberships
  for update
  to authenticated
  using (public.can_manage_users(tenant_id))
  with check (public.can_manage_users(tenant_id));

do $$
declare
  v_all text[] := array[
    '/home',
    '/kereso',
    '/opti',
    '/ugyfelek',
    '/ajanlatok',
    '/megrendelesek',
    '/torzsadatok/alapanyagok/tablas-anyagok',
    '/torzsadatok/alapanyagok/elzarok',
    '/torzsadatok/rendszer/adonem',
    '/torzsadatok/rendszer/fizetesi-modok',
    '/torzsadatok/rendszer/egysegek',
    '/torzsadatok/rendszer/dij-tipusok',
    '/torzsadatok/rendszer/gyartok',
    '/torzsadatok/rendszer/berendezes',
    '/torzsadatok/rendszer/gyartogepek',
    '/beallitasok/cegadatok',
    '/beallitasok/opti',
    '/beallitasok/felhasznalok'
  ];
  v_office text[] := array[
    '/home',
    '/kereso',
    '/opti',
    '/ugyfelek',
    '/ajanlatok',
    '/megrendelesek',
    '/beallitasok/cegadatok'
  ];
  r record;
  k text;
  keys text[];
begin
  for r in
    select id, tenant_id, role
    from public.tenant_memberships
  loop
    if r.role in ('owner', 'admin') then
      keys := v_all;
    else
      keys := v_office;
    end if;

    foreach k in array keys
    loop
      insert into public.tenant_membership_page_access (
        tenant_id, membership_id, page_key, can_access
      )
      values (r.tenant_id, r.id, k, true)
      on conflict (membership_id, page_key) do update
      set can_access = true,
          updated_at = now();
    end loop;

    -- home mindig
    insert into public.tenant_membership_page_access (
      tenant_id, membership_id, page_key, can_access
    )
    values (r.tenant_id, r.id, '/home', true)
    on conflict (membership_id, page_key) do update
    set can_access = true,
        updated_at = now();
  end loop;
end $$;
