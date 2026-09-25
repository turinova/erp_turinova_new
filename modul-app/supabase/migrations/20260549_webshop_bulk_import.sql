-- Bolt katalógus tömeges Excel import (doc 39 §4a, 09 §6b):
-- 1) tenant-imports bucket: a feltöltött fájl a Vercel 4,5 MB-os kéréskorlátja helyett ide megy
-- 2) web_variant_groups: változatcsoport neve, fő terméke, tengelyei
-- 3) webshop_import_runs: futások (zár, mentés-fájl a visszavonáshoz)
-- 4) webshop_import_mappings: megjegyzett párosítások (beszállítói név → saját kategória / érték)
-- 5) webshop_import_apply: egy köteg termék bolt-adata egy tranzakcióban

-- ---------------------------------------------------------------------------
-- 1) Storage
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tenant-imports',
  'tenant-imports',
  false,
  52428800,
  array[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'application/octet-stream'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists tenant_imports_select on storage.objects;
create policy tenant_imports_select
  on storage.objects for select to authenticated
  using (
    bucket_id = 'tenant-imports'
    and public.can_write_tenant(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists tenant_imports_insert on storage.objects;
create policy tenant_imports_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'tenant-imports'
    and public.can_write_tenant(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists tenant_imports_update on storage.objects;
create policy tenant_imports_update
  on storage.objects for update to authenticated
  using (
    bucket_id = 'tenant-imports'
    and public.can_write_tenant(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'tenant-imports'
    and public.can_write_tenant(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists tenant_imports_delete on storage.objects;
create policy tenant_imports_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'tenant-imports'
    and public.can_write_tenant(((storage.foldername(name))[1])::uuid)
  );

-- ---------------------------------------------------------------------------
-- 2) Változatcsoportok
-- ---------------------------------------------------------------------------
create table if not exists public.web_variant_groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  code text not null,
  name text,
  main_accessory_id uuid references public.accessories (id) on delete set null,
  -- product_attributes.id szövegként, vagy '__pack' (kiszerelés). Üres = automatikus.
  axes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint web_variant_groups_code_len check (char_length(trim(code)) between 1 and 64),
  constraint web_variant_groups_name_len check (name is null or char_length(name) <= 150),
  constraint web_variant_groups_axes_max check (cardinality(axes) <= 3)
);

create unique index if not exists web_variant_groups_tenant_code_uidx
  on public.web_variant_groups (tenant_id, lower(code));

alter table public.web_variant_groups enable row level security;

drop policy if exists web_variant_groups_select on public.web_variant_groups;
create policy web_variant_groups_select
  on public.web_variant_groups for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists web_variant_groups_write on public.web_variant_groups;
create policy web_variant_groups_write
  on public.web_variant_groups for all to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

grant select, insert, update, delete on public.web_variant_groups to authenticated;

comment on table public.web_variant_groups is
  'Változatcsoport (accessory_web.web_group_id) adatai: név, fő termék (kategória kártya), tengelyek sorrendje.';

-- ---------------------------------------------------------------------------
-- 3) Import futások
-- ---------------------------------------------------------------------------
create table if not exists public.webshop_import_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  file_name text not null,
  source_path text,
  backup_path text,
  kind text not null default 'import',
  status text not null default 'running',
  stats jsonb not null default '{}'::jsonb,
  restores_run_id uuid references public.webshop_import_runs (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint webshop_import_runs_kind_chk check (kind in ('import', 'restore')),
  constraint webshop_import_runs_status_chk check (status in ('running', 'done', 'failed', 'undone')),
  constraint webshop_import_runs_file_len check (char_length(file_name) <= 200)
);

create index if not exists webshop_import_runs_tenant_idx
  on public.webshop_import_runs (tenant_id, created_at desc);

alter table public.webshop_import_runs enable row level security;

drop policy if exists webshop_import_runs_select on public.webshop_import_runs;
create policy webshop_import_runs_select
  on public.webshop_import_runs for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists webshop_import_runs_insert on public.webshop_import_runs;
create policy webshop_import_runs_insert
  on public.webshop_import_runs for insert to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists webshop_import_runs_update on public.webshop_import_runs;
create policy webshop_import_runs_update
  on public.webshop_import_runs for update to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

grant select, insert, update on public.webshop_import_runs to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Megjegyzett párosítások
-- ---------------------------------------------------------------------------
create table if not exists public.webshop_import_mappings (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  kind text not null,
  source_key text not null,
  target_id uuid not null,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, kind, source_key),
  constraint webshop_import_mappings_kind_chk check (kind in ('category', 'value', 'attribute')),
  constraint webshop_import_mappings_key_len check (char_length(source_key) between 1 and 400)
);

alter table public.webshop_import_mappings enable row level security;

drop policy if exists webshop_import_mappings_select on public.webshop_import_mappings;
create policy webshop_import_mappings_select
  on public.webshop_import_mappings for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists webshop_import_mappings_write on public.webshop_import_mappings;
create policy webshop_import_mappings_write
  on public.webshop_import_mappings for all to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

grant select, insert, update, delete on public.webshop_import_mappings to authenticated;

-- ---------------------------------------------------------------------------
-- 5) Köteg mentése egy tranzakcióban (RLS érvényes: security invoker)
-- ---------------------------------------------------------------------------
-- p_items: [{ accessory_id,
--   web?: {accessory_web oszlopok},
--   attr_list?: [attribute_id] + value_ids: [attribute_value_id]   (ezek listaértékei cserélődnek)
--   attr_input?: [attribute_id] + inputs: [{attribute_id, value_num, value_max, value_bool}]
--   related_kinds?: [kind] + related: [{related_id, kind, sort_order}]
--   alt_reverse_add?: [accessory_id], alt_reverse_remove?: [accessory_id]
--   documents?: [{media_id, kind, title, language, sort_order}] }]
create or replace function public.webshop_import_apply(p_tenant uuid, p_items jsonb)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  it jsonb;
  v_id uuid;
  v_set text;
  n integer := 0;
begin
  if not public.can_write_tenant(p_tenant) then
    raise exception 'Nincs jogosultság.' using errcode = '42501';
  end if;

  for it in select value from jsonb_array_elements(p_items) loop
    v_id := (it ->> 'accessory_id')::uuid;
    if not exists (
      select 1 from public.accessories a
      where a.id = v_id and a.tenant_id = p_tenant and a.deleted_at is null
    ) then
      raise exception 'Ismeretlen termék: %', v_id using errcode = 'P0002';
    end if;

    if it ? 'web' then
      insert into public.accessory_web (accessory_id, tenant_id)
      values (v_id, p_tenant)
      on conflict (accessory_id) do nothing;
      select string_agg(format('%1$I = ($1).%1$I', k), ', ')
      into v_set
      from jsonb_object_keys(it -> 'web') k
      where k not in ('accessory_id', 'tenant_id', 'created_at', 'updated_at');
      if v_set is not null then
        execute format(
          'update public.accessory_web set %s, updated_at = now() where accessory_id = $2',
          v_set
        ) using jsonb_populate_record(null::public.accessory_web, it -> 'web'), v_id;
      end if;
    end if;

    if it ? 'attr_list' then
      delete from public.accessory_attribute_values av
      using public.attribute_values v
      where av.accessory_id = v_id
        and v.id = av.attribute_value_id
        and v.attribute_id in (select x::uuid from jsonb_array_elements_text(it -> 'attr_list') x);
      insert into public.accessory_attribute_values (tenant_id, accessory_id, attribute_value_id)
      select p_tenant, v_id, x::uuid
      from jsonb_array_elements_text(coalesce(it -> 'value_ids', '[]'::jsonb)) x
      on conflict do nothing;
    end if;

    if it ? 'attr_input' then
      delete from public.accessory_attribute_inputs
      where accessory_id = v_id
        and attribute_id in (select x::uuid from jsonb_array_elements_text(it -> 'attr_input') x);
      insert into public.accessory_attribute_inputs (
        tenant_id, accessory_id, attribute_id, value_num, value_max, value_bool
      )
      select
        p_tenant,
        v_id,
        (e ->> 'attribute_id')::uuid,
        (e ->> 'value_num')::numeric,
        (e ->> 'value_max')::numeric,
        (e ->> 'value_bool')::boolean
      from jsonb_array_elements(coalesce(it -> 'inputs', '[]'::jsonb)) e;
    end if;

    if it ? 'related_kinds' then
      delete from public.accessory_related
      where accessory_id = v_id
        and kind in (select jsonb_array_elements_text(it -> 'related_kinds'));
      insert into public.accessory_related (tenant_id, accessory_id, related_id, kind, sort_order)
      select p_tenant, v_id, (e ->> 'related_id')::uuid, e ->> 'kind', coalesce((e ->> 'sort_order')::integer, 100)
      from jsonb_array_elements(coalesce(it -> 'related', '[]'::jsonb)) e
      on conflict (accessory_id, related_id) do update
      set kind = excluded.kind, sort_order = excluded.sort_order;
    end if;

    if it ? 'alt_reverse_add' then
      insert into public.accessory_related (tenant_id, accessory_id, related_id, kind, sort_order)
      select p_tenant, x::uuid, v_id, 'alternative', 100
      from jsonb_array_elements_text(it -> 'alt_reverse_add') x
      where exists (
        select 1 from public.accessories a
        where a.id = x::uuid and a.tenant_id = p_tenant and a.deleted_at is null
      )
      on conflict (accessory_id, related_id) do nothing;
    end if;

    if it ? 'alt_reverse_remove' then
      delete from public.accessory_related
      where related_id = v_id
        and kind = 'alternative'
        and accessory_id in (select x::uuid from jsonb_array_elements_text(it -> 'alt_reverse_remove') x);
    end if;

    if it ? 'documents' then
      delete from public.accessory_documents where accessory_id = v_id;
      insert into public.accessory_documents (
        tenant_id, accessory_id, media_id, kind, title, language, sort_order
      )
      select
        p_tenant,
        v_id,
        (e ->> 'media_id')::uuid,
        coalesce(e ->> 'kind', 'other'),
        nullif(e ->> 'title', ''),
        coalesce(e ->> 'language', 'hu'),
        coalesce((e ->> 'sort_order')::integer, 100)
      from jsonb_array_elements(it -> 'documents') e
      on conflict (accessory_id, media_id) do nothing;
    end if;

    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function public.webshop_import_apply(uuid, jsonb) from public;
grant execute on function public.webshop_import_apply(uuid, jsonb) to authenticated;

comment on function public.webshop_import_apply(uuid, jsonb) is
  'Bolt Excel import: egy köteg termék bolt-adata, jellemzői, kapcsolatai, dokumentumai — egy tranzakció.';
