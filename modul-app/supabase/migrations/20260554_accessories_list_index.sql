-- Terméklista: gyors (tenant_id, name) rendezés ~30k+ sorra.
create index if not exists accessories_tenant_name_alive_idx
  on public.accessories (tenant_id, name, id)
  where deleted_at is null;

comment on index public.accessories_tenant_name_alive_idx is
  'Lista: order by name, id tenantonként (élő sorok).';
