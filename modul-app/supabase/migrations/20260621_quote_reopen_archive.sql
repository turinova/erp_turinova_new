-- Lezárt megrendelés újranyitás + archív (lista takarítás). Nem hard-delete.

alter table public.quotes
  add column if not exists reopened_at timestamptz,
  add column if not exists reopened_by uuid references auth.users (id) on delete set null,
  add column if not exists reopened_by_label_snapshot text,
  add column if not exists reopen_reason text,
  add column if not exists reopen_note text,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users (id) on delete set null,
  add column if not exists archived_by_label_snapshot text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'quotes_reopen_reason_check'
  ) then
    alter table public.quotes
      add constraint quotes_reopen_reason_check
      check (
        reopen_reason is null
        or reopen_reason in (
          'accidental',
          'customer_return',
          'wrong_handover',
          'other'
        )
      );
  end if;
end $$;

comment on column public.quotes.reopened_at is
  'finished → ready újranyitás ideje (átadás visszavonása).';
comment on column public.quotes.reopen_reason is
  'accidental | customer_return | wrong_handover | other';
comment on column public.quotes.reopen_note is
  'Szabad szöveg; other esetén kötelező az appban.';
comment on column public.quotes.archived_at is
  'Lista defaultból rejtett soft archív (finished / cancelled).';

-- Aktív (nem archív) listák gyorsítása
create index if not exists quotes_tenant_active_list_idx
  on public.quotes (tenant_id, updated_at desc)
  where deleted_at is null and archived_at is null;

create index if not exists quotes_tenant_archived_list_idx
  on public.quotes (tenant_id, archived_at desc)
  where deleted_at is null and archived_at is not null;
