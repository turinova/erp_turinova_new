-- PDA → pult kosárátadás (pda_pos addon). Online pick list / parked cart.

create table if not exists public.pos_cart_handoffs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  code text not null,
  status text not null default 'open'
    constraint pos_cart_handoffs_status_chk
      check (status in ('open', 'claimed', 'completed', 'cancelled', 'expired')),
  warehouse_id uuid not null references public.warehouses (id),
  customer_id uuid null references public.customers (id) on delete set null,
  created_by uuid not null references auth.users (id),
  created_by_name text null,
  claimed_by uuid null references auth.users (id),
  claimed_at timestamptz null,
  lines jsonb not null default '[]'::jsonb,
  note text null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pos_cart_handoffs_tenant_code_uidx unique (tenant_id, code)
);

comment on table public.pos_cart_handoffs is
  'PDA kosár átadás a pulti POS-ra. Feature: pda_pos addon.';

create index if not exists pos_cart_handoffs_tenant_open_idx
  on public.pos_cart_handoffs (tenant_id, created_at desc)
  where status = 'open';

create index if not exists pos_cart_handoffs_tenant_status_idx
  on public.pos_cart_handoffs (tenant_id, status, created_at desc);

alter table public.pos_cart_handoffs enable row level security;

drop policy if exists pos_cart_handoffs_select_member on public.pos_cart_handoffs;
create policy pos_cart_handoffs_select_member
  on public.pos_cart_handoffs for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists pos_cart_handoffs_insert_writer on public.pos_cart_handoffs;
create policy pos_cart_handoffs_insert_writer
  on public.pos_cart_handoffs for insert to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists pos_cart_handoffs_update_writer on public.pos_cart_handoffs;
create policy pos_cart_handoffs_update_writer
  on public.pos_cart_handoffs for update to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

-- Következő P-001 stílusú kód (tenant szinten növekedő).
create or replace function public.next_pos_handoff_code(p_tenant_id uuid)
returns text
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  n integer;
begin
  select coalesce(
    max(
      case
        when code ~ '^P-[0-9]+$'
          then nullif(substring(code from 3), '')::integer
        else null
      end
    ),
    0
  ) + 1
  into n
  from public.pos_cart_handoffs
  where tenant_id = p_tenant_id;

  return 'P-' || lpad(n::text, greatest(3, length(n::text)), '0');
end;
$$;

revoke all on function public.next_pos_handoff_code(uuid) from public;
grant execute on function public.next_pos_handoff_code(uuid) to authenticated;

-- Atomikus claim: csak open + nem lejárt.
create or replace function public.claim_pos_cart_handoff(
  p_tenant_id uuid,
  p_handoff_id uuid,
  p_claimed_by uuid
)
returns public.pos_cart_handoffs
language plpgsql
security invoker
set search_path = public
as $$
declare
  row public.pos_cart_handoffs;
begin
  if not public.can_write_tenant(p_tenant_id) then
    raise exception 'Nincs írási jog.';
  end if;

  update public.pos_cart_handoffs h
  set
    status = 'claimed',
    claimed_by = p_claimed_by,
    claimed_at = now(),
    updated_at = now()
  where h.id = p_handoff_id
    and h.tenant_id = p_tenant_id
    and h.status = 'open'
    and h.expires_at > now()
  returning * into row;

  if row.id is null then
    raise exception 'A kosár már átvéve, lejárt, vagy nem található.';
  end if;

  return row;
end;
$$;

revoke all on function public.claim_pos_cart_handoff(uuid, uuid, uuid) from public;
grant execute on function public.claim_pos_cart_handoff(uuid, uuid, uuid) to authenticated;

-- Lejárt open → expired (opcionális takarítás híváskor).
create or replace function public.expire_pos_cart_handoffs(p_tenant_id uuid)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  n integer;
begin
  if not public.is_tenant_member(p_tenant_id) then
    return 0;
  end if;

  update public.pos_cart_handoffs
  set status = 'expired', updated_at = now()
  where tenant_id = p_tenant_id
    and status = 'open'
    and expires_at <= now();

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.expire_pos_cart_handoffs(uuid) from public;
grant execute on function public.expire_pos_cart_handoffs(uuid) to authenticated;
