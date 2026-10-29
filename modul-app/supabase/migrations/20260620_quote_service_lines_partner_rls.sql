-- Partner RLS: quote_service_lines (megmunkálás) — mint quote_edge_lines
-- Nélküle partner Opti mentés: "new row violates row-level security policy"

drop policy if exists quote_service_lines_select_partner on public.quote_service_lines;
create policy quote_service_lines_select_partner
  on public.quote_service_lines
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.quote_material_lines ml
      join public.quotes q on q.id = ml.quote_id
      where ml.id = quote_material_line_id
        and q.partner_profile_id = auth.uid()
        and q.deleted_at is null
    )
  );

drop policy if exists quote_service_lines_insert_partner on public.quote_service_lines;
create policy quote_service_lines_insert_partner
  on public.quote_service_lines
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.quote_material_lines ml
      join public.quotes q on q.id = ml.quote_id
      where ml.id = quote_material_line_id
        and q.partner_profile_id = auth.uid()
        and q.source = 'portal'
        and q.status = 'draft'
        and q.portal_submitted_at is null
        and q.deleted_at is null
    )
  );

drop policy if exists quote_service_lines_update_partner on public.quote_service_lines;
create policy quote_service_lines_update_partner
  on public.quote_service_lines
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.quote_material_lines ml
      join public.quotes q on q.id = ml.quote_id
      where ml.id = quote_material_line_id
        and q.partner_profile_id = auth.uid()
        and q.source = 'portal'
        and q.status = 'draft'
        and q.portal_submitted_at is null
        and q.deleted_at is null
    )
  )
  with check (
    exists (
      select 1
      from public.quote_material_lines ml
      join public.quotes q on q.id = ml.quote_id
      where ml.id = quote_material_line_id
        and q.partner_profile_id = auth.uid()
        and q.source = 'portal'
        and q.status = 'draft'
        and q.portal_submitted_at is null
        and q.deleted_at is null
    )
  );

drop policy if exists quote_service_lines_delete_partner on public.quote_service_lines;
create policy quote_service_lines_delete_partner
  on public.quote_service_lines
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.quote_material_lines ml
      join public.quotes q on q.id = ml.quote_id
      where ml.id = quote_material_line_id
        and q.partner_profile_id = auth.uid()
        and q.source = 'portal'
        and q.status = 'draft'
        and q.portal_submitted_at is null
        and q.deleted_at is null
    )
  );

comment on table public.quote_service_lines is
  'Opti megmunkálás sorok anyagonként (duplung / szög / pánthely). Staff + partner draft RLS.';
