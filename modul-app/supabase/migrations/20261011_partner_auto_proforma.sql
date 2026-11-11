-- Partner beküldés + átutalás → automatikus Számlázz.hu díjbekérő.
-- Beállítás: /beallitasok/partner. Állapot az ajánlaton (staff jelzés + újraküldés).
-- Docs: 20-partner-portal.md

alter table public.tenant_partner_settings
  add column if not exists auto_proforma_on_transfer boolean not null default false,
  add column if not exists auto_proforma_due_days integer not null default 8;

alter table public.tenant_partner_settings
  drop constraint if exists tenant_partner_settings_auto_proforma_due_days_check;
alter table public.tenant_partner_settings
  add constraint tenant_partner_settings_auto_proforma_due_days_check
  check (auto_proforma_due_days between 1 and 60);

comment on column public.tenant_partner_settings.auto_proforma_on_transfer is
  'Partner beküldés átutalással → automatikus díjbekérő (Számlázz.hu Agent kulcs kell).';
comment on column public.tenant_partner_settings.auto_proforma_due_days is
  'Automatikus díjbekérő fizetési határideje napban.';

alter table public.quotes
  add column if not exists auto_proforma_status text,
  add column if not exists auto_proforma_note text,
  add column if not exists auto_proforma_at timestamptz;

alter table public.quotes
  drop constraint if exists quotes_auto_proforma_status_check;
alter table public.quotes
  add constraint quotes_auto_proforma_status_check
  check (
    auto_proforma_status is null
    or auto_proforma_status in ('pending', 'processing', 'issued', 'failed', 'skipped')
  );

comment on column public.quotes.auto_proforma_status is
  'Automatikus díjbekérő: pending → processing → issued | failed | skipped.';
comment on column public.quotes.auto_proforma_note is
  'Díjbekérő szám (issued) vagy a hiba / kihagyás oka.';

create index if not exists quotes_auto_proforma_open_idx
  on public.quotes (tenant_id, auto_proforma_status)
  where auto_proforma_status in ('pending', 'processing', 'failed', 'skipped')
    and deleted_at is null;

-- Partner (nem cég-író) nem állíthatja az automatikus díjbekérő mezőket.
create or replace function public.quotes_guard_auto_proforma()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') <> 'authenticated' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if (new.auto_proforma_status is not null or new.auto_proforma_note is not null)
      and not public.can_write_tenant(new.tenant_id) then
      raise exception 'quotes_auto_proforma_locked';
    end if;
    return new;
  end if;
  if (
    new.auto_proforma_status is distinct from old.auto_proforma_status
    or new.auto_proforma_note is distinct from old.auto_proforma_note
    or new.auto_proforma_at is distinct from old.auto_proforma_at
  ) and not public.can_write_tenant(new.tenant_id) then
    raise exception 'quotes_auto_proforma_locked';
  end if;
  return new;
end;
$$;

drop trigger if exists quotes_guard_auto_proforma_trg on public.quotes;
create trigger quotes_guard_auto_proforma_trg
  before insert or update on public.quotes
  for each row
  execute function public.quotes_guard_auto_proforma();
