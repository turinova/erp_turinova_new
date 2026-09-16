-- Partner regisztráció: ÁSZF + adatkezelés elfogadás időbélyege

alter table public.partner_profiles
  add column if not exists terms_accepted_at timestamptz;

comment on column public.partner_profiles.terms_accepted_at is
  'ÁSZF + adatkezelési tájékoztató elfogadásának időpontja (regisztráció).';
