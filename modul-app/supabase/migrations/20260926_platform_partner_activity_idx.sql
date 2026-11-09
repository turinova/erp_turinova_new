-- Platform partnerek lista / detail: gyors portal quote aggregáció
-- (partner_profile_id + submitted / draft szűrés).

create index if not exists quotes_partner_portal_alive_idx
  on public.quotes (partner_profile_id, portal_submitted_at desc)
  where deleted_at is null
    and source = 'portal'
    and partner_profile_id is not null;

create index if not exists partner_profiles_must_set_password_idx
  on public.partner_profiles (must_set_password)
  where must_set_password = true;
