-- Lean manuális előfizetés: egy igazság = access_until (nap).
-- Státusz a dátumból jön; billing_status / trial_ends_at / paid_through legacy sync.

alter table public.tenants
  add column if not exists access_until date,
  add column if not exists access_source text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tenants_access_source_check'
  ) then
    alter table public.tenants
      add constraint tenants_access_source_check
      check (
        access_source is null
        or access_source in ('trial', 'paid', 'manual')
      );
  end if;
end $$;

create index if not exists tenants_access_until_idx
  on public.tenants (access_until)
  where access_until is not null;

comment on column public.tenants.access_until is
  'Hozzáférés utolsó napja (Europe/Budapest nap). Egy igazság a manuális billinghez.';
comment on column public.tenants.access_source is
  'trial | paid | manual — honnan jött a dátum (UI badge).';

-- Backfill: paid_through elsőbbség, különben trial_ends_at
update public.tenants
set
  access_until = coalesce(
    (paid_through at time zone 'Europe/Budapest')::date,
    (trial_ends_at at time zone 'Europe/Budapest')::date
  ),
  access_source = case
    when paid_through is not null then 'paid'
    when trial_ends_at is not null then 'trial'
    else null
  end
where access_until is null
  and (paid_through is not null or trial_ends_at is not null);

-- Legacy billing_status igazítás a dátumhoz (UI már nem szerkeszti)
update public.tenants t
set billing_status = case
  when t.access_until is null then 'none'
  when t.access_until >= (timezone('Europe/Budapest', now()))::date
    and coalesce(t.access_source, '') = 'trial' then 'trial'
  when t.access_until >= (timezone('Europe/Budapest', now()))::date then 'active'
  when t.access_until
    >= (timezone('Europe/Budapest', now()))::date - 14 then 'past_due'
  else 'canceled'
end
where t.access_until is not null
   or t.billing_status is distinct from 'none';
