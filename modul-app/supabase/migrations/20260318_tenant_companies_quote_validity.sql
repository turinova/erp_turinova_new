-- modul-app: quote PDF validity days on tenant company profile
-- Default 14 = main-app parity (created_at + 2 weeks).

alter table public.tenant_companies
  add column if not exists quote_validity_days integer not null default 14;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tenant_companies_quote_validity_days_check'
  ) then
    alter table public.tenant_companies
      add constraint tenant_companies_quote_validity_days_check
      check (quote_validity_days between 1 and 365);
  end if;
end $$;

comment on column public.tenant_companies.quote_validity_days is
  'Árajánlat PDF érvényesség napokban (keltezéstől). Default 14.';
