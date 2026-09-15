-- Partner katalógus olvasás: szálas + termék (+ egység embed)
-- A táblás / élzáró / manufacturers / tax_rates már a 20260331-ben megvan.
-- Hiányuk miatt a partner kereső kind=linear / accessory üres volt.

drop policy if exists linear_materials_select_partner on public.linear_materials;
create policy linear_materials_select_partner
  on public.linear_materials
  for select
  to authenticated
  using (
    deleted_at is null
    and public.partner_can_read_tenant_catalog(tenant_id)
  );

drop policy if exists accessories_select_partner on public.accessories;
create policy accessories_select_partner
  on public.accessories
  for select
  to authenticated
  using (
    deleted_at is null
    and public.partner_can_read_tenant_catalog(tenant_id)
  );

-- Termék kereső embed: units (shortform)
drop policy if exists units_select_partner on public.units;
create policy units_select_partner
  on public.units
  for select
  to authenticated
  using (
    deleted_at is null
    and public.partner_can_read_tenant_catalog(tenant_id)
  );
