-- =============================================================================
-- Építő Ártükör — Saját cég profil mezők (manuálisan futtasd a Supabase SQL Editorban)
-- =============================================================================
-- Előfeltétel: 001_auth_foundation.sql már lefutott
-- =============================================================================

alter table public.organizations
  add column if not exists hq_postal_code text,
  add column if not exists hq_city text,
  add column if not exists hq_street text,
  add column if not exists use_separate_mailing_address boolean not null default false,
  add column if not exists mail_postal_code text,
  add column if not exists mail_city text,
  add column if not exists mail_street text,
  add column if not exists tax_number text,
  add column if not exists registration_number text,
  add column if not exists representative text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists bank_name text,
  add column if not exists bank_account text,
  add column if not exists logo_data_url text,
  add column if not exists default_vat_mode text not null default 'standard'
    check (default_vat_mode in ('standard', 'reduced', 'aam', 'reverse_charge'));

-- Demo cég alap értékek (idempotens)
update public.organizations o
set
  hq_postal_code = coalesce(o.hq_postal_code, '1051'),
  hq_city = coalesce(o.hq_city, 'Budapest'),
  hq_street = coalesce(o.hq_street, 'Példa utca 12.'),
  tax_number = coalesce(o.tax_number, '12345678-2-42'),
  registration_number = coalesce(o.registration_number, '01-09-123456'),
  representative = coalesce(o.representative, 'Kovács János ügyvezető'),
  email = coalesce(o.email, 'info@pelda-epito.hu'),
  phone = coalesce(o.phone, '+36 1 234 5678'),
  bank_name = coalesce(o.bank_name, 'OTP Bank Nyrt.'),
  bank_account = coalesce(o.bank_account, '11773016-12345678-00000000'),
  default_vat_mode = coalesce(o.default_vat_mode, 'standard')
where o.slug = 'demo';

-- Tagok módosíthatják a saját cég adatait
drop policy if exists "organizations_update_member" on public.organizations;
create policy "organizations_update_member"
  on public.organizations for update
  using (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = organizations.id
        and om.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = organizations.id
        and om.user_id = auth.uid()
    )
  );
