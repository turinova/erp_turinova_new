-- ============================================================
-- 016 — Projekt-fájlok: mappák + fájl-metaadatok + Storage bucket
-- Futtatás: a 011_projects.sql után (FK-függés).
-- ============================================================

-- ---------- Mappák ----------
create table if not exists public.project_folders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  sort_order int not null default 1,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists project_folders_name_uniq
  on public.project_folders (project_id, lower(name));
create index if not exists project_folders_project_idx
  on public.project_folders (project_id);

alter table public.project_folders enable row level security;

drop policy if exists project_folders_select on public.project_folders;
create policy project_folders_select on public.project_folders
  for select using (public.is_org_member(organization_id));
drop policy if exists project_folders_insert on public.project_folders;
create policy project_folders_insert on public.project_folders
  for insert with check (public.is_org_member(organization_id));
drop policy if exists project_folders_update on public.project_folders;
create policy project_folders_update on public.project_folders
  for update using (public.is_org_member(organization_id));
drop policy if exists project_folders_delete on public.project_folders;
create policy project_folders_delete on public.project_folders
  for delete using (public.is_org_member(organization_id));

-- ---------- Fájl-metaadatok ----------
create table if not exists public.project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  folder_id uuid references public.project_folders(id) on delete set null,
  category text not null default 'other'
    check (category in ('site_photo','floor_plan','technical','permit','contract','quote_export','sub_rfq','other')),
  title text not null,
  description text,
  file_name text not null,
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null default 0,
  -- 'storage:<path>' (Supabase Storage) vagy 'url:<https://...>'
  storage_key text not null,
  quote_id uuid references public.quotes(id) on delete set null,
  rfq_id uuid references public.rfqs(id) on delete set null,
  taken_at date,
  is_cover boolean not null default false,
  sort_order int not null default 1,
  uploaded_at timestamptz not null default now()
);

create index if not exists project_files_project_idx on public.project_files (project_id);
create index if not exists project_files_folder_idx on public.project_files (folder_id);

alter table public.project_files enable row level security;

drop policy if exists project_files_select on public.project_files;
create policy project_files_select on public.project_files
  for select using (public.is_org_member(organization_id));
drop policy if exists project_files_insert on public.project_files;
create policy project_files_insert on public.project_files
  for insert with check (public.is_org_member(organization_id));
drop policy if exists project_files_update on public.project_files;
create policy project_files_update on public.project_files
  for update using (public.is_org_member(organization_id));
drop policy if exists project_files_delete on public.project_files;
create policy project_files_delete on public.project_files
  for delete using (public.is_org_member(organization_id));

-- ---------- Storage bucket + policy-k (csak éles Supabase-en fut) ----------
-- A fájlok útvonala: <organization_id>/<project_id>/<file_id>
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public)
    values ('project-files', 'project-files', false)
    on conflict (id) do nothing;

    begin
      drop policy if exists project_files_storage_select on storage.objects;
      create policy project_files_storage_select on storage.objects
        for select using (
          bucket_id = 'project-files'
          and public.is_org_member(((string_to_array(name, '/'))[1])::uuid)
        );

      drop policy if exists project_files_storage_insert on storage.objects;
      create policy project_files_storage_insert on storage.objects
        for insert with check (
          bucket_id = 'project-files'
          and public.is_org_member(((string_to_array(name, '/'))[1])::uuid)
        );

      drop policy if exists project_files_storage_delete on storage.objects;
      create policy project_files_storage_delete on storage.objects
        for delete using (
          bucket_id = 'project-files'
          and public.is_org_member(((string_to_array(name, '/'))[1])::uuid)
        );
    exception when insufficient_privilege then
      raise notice 'storage.objects policy-k kihagyva (nincs jogosultság) — állítsd be a Supabase dashboardon.';
    end;
  end if;
end
$$;
