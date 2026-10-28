-- Lapszabászat megrendelés lemondás meta (audit). status=cancelled már létezik.

alter table public.quotes
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references auth.users (id) on delete set null,
  add column if not exists cancelled_by_label_snapshot text,
  add column if not exists cancel_reason text,
  add column if not exists cancel_note text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'quotes_cancel_reason_check'
  ) then
    alter table public.quotes
      add constraint quotes_cancel_reason_check
      check (
        cancel_reason is null
        or cancel_reason in ('customer', 'wrong_order', 'material', 'other')
      );
  end if;
end $$;

comment on column public.quotes.cancelled_at is
  'Megrendelés lemondás ideje (status=cancelled).';
comment on column public.quotes.cancel_reason is
  'customer | wrong_order | material | other';
comment on column public.quotes.cancel_note is
  'Szabad szöveg; other esetén kötelező az appban.';
