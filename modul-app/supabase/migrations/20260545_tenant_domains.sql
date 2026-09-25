-- Storefront domainek: saját domain (custom) a boltnak + host → bolt feloldás.
-- Az azonnali aldomain (<slug>.<STOREFRONT_ROOT_DOMAIN>) nem tárolt sor: a tenants.slug-ból jön.
-- Írás a webshop „Csatornák” oldalról (RLS: can_write_tenant); ellenőrző cron service role-lal.

create table if not exists public.tenant_domains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  hostname text not null
    check (hostname = lower(hostname) and hostname ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'),
  -- www.<apex> alias: ugyanide mutat, a fő címre irányítunk
  alias_hostname text
    check (alias_hostname is null or alias_hostname = lower(alias_hostname)),
  status text not null default 'pending'
    check (status in ('pending', 'verifying', 'active', 'error')),
  is_primary boolean not null default false,
  dns_provider text check (dns_provider is null or char_length(dns_provider) <= 40),
  -- utolsó ellenőrzés soronként (típus, név, érték, állapot, üzenet) — a varázsló ezt mutatja
  check_result jsonb not null default '{}'::jsonb,
  last_error text check (last_error is null or char_length(last_error) <= 500),
  last_checked_at timestamptz,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz
);

create unique index if not exists tenant_domains_hostname_uidx
  on public.tenant_domains (hostname) where deleted_at is null;

create unique index if not exists tenant_domains_alias_uidx
  on public.tenant_domains (alias_hostname)
  where deleted_at is null and alias_hostname is not null;

create unique index if not exists tenant_domains_primary_uidx
  on public.tenant_domains (tenant_id) where is_primary and deleted_at is null;

create index if not exists tenant_domains_pending_idx
  on public.tenant_domains (last_checked_at nulls first)
  where status in ('pending', 'verifying') and deleted_at is null;

alter table public.tenant_domains enable row level security;

drop policy if exists tenant_domains_select on public.tenant_domains;
drop policy if exists tenant_domains_insert on public.tenant_domains;
drop policy if exists tenant_domains_update on public.tenant_domains;

create policy tenant_domains_select
  on public.tenant_domains for select to authenticated
  using (public.is_tenant_member(tenant_id));

create policy tenant_domains_insert
  on public.tenant_domains for insert to authenticated
  with check (public.can_write_tenant(tenant_id));

create policy tenant_domains_update
  on public.tenant_domains for update to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

comment on table public.tenant_domains is
  'Bolt saját domainje(i). status=active + is_primary → ez a kanonikus cím (sitemap, feed, JSON-LD).';

-- Host → bolt (middleware, anon kulccsal). Csak slugot és a fő hostot adja vissza.
create or replace function public.storefront_resolve_host(p_host text, p_root text)
returns table (site text, primary_host text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_host text := lower(trim(coalesce(p_host, '')));
  v_root text := lower(trim(coalesce(p_root, '')));
  v_tenant uuid;
  v_slug text;
  v_label text;
  v_primary text;
begin
  if v_host = '' then
    return;
  end if;

  if v_root <> '' and right(v_host, char_length(v_root) + 1) = '.' || v_root then
    v_label := left(v_host, char_length(v_host) - char_length(v_root) - 1);
    if v_label = '' or position('.' in v_label) > 0 then
      return;
    end if;
    select t.id, t.slug into v_tenant, v_slug
    from public.tenants t
    where t.slug = v_label and t.status in ('active', 'read_only');
  else
    select t.id, t.slug into v_tenant, v_slug
    from public.tenant_domains d
    join public.tenants t on t.id = d.tenant_id
    where (d.hostname = v_host or d.alias_hostname = v_host)
      and d.status = 'active'
      and d.deleted_at is null
      and t.status in ('active', 'read_only')
    limit 1;
  end if;

  if v_tenant is null then
    return;
  end if;

  if not exists (
    select 1 from public.tenant_entitlements e
    where e.tenant_id = v_tenant
      and (e.feature_key = 'webshop' or e.feature_key like '/webshop%')
  ) then
    return;
  end if;

  select d.hostname into v_primary
  from public.tenant_domains d
  where d.tenant_id = v_tenant
    and d.is_primary
    and d.status = 'active'
    and d.deleted_at is null
  limit 1;

  return query select
    v_slug,
    coalesce(v_primary, case when v_root <> '' then v_slug || '.' || v_root else v_host end);
end;
$$;

revoke all on function public.storefront_resolve_host(text, text) from public;
grant execute on function public.storefront_resolve_host(text, text) to anon, authenticated, service_role;
