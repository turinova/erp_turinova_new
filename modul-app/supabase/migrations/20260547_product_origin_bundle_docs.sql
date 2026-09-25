-- Termékszintű AI-adatok (doc 40 §3f), kategóriafüggetlen:
-- 1) accessories: származási ország, több darabos kiszerelés, csomagajánlat
-- 2) accessory_related: kapcsolattípusok (kell hozzá / tartozék / alternatíva / nagyobb kiszerelés)
-- 3) accessory_documents: PDF dokumentumok (útmutató, biztonsági adatlap, nyilatkozat…)
-- 4) tenant-media bucket: PDF is (10 MB); képekre az app 2 MB-ot tart

-- ---------------------------------------------------------------------------
-- 1) Termék
-- ---------------------------------------------------------------------------
alter table public.accessories
  add column if not exists web_country_of_origin text,
  add column if not exists web_multipack integer,
  add column if not exists web_is_bundle boolean not null default false;

alter table public.accessories
  drop constraint if exists accessories_web_country_of_origin_chk;
alter table public.accessories
  add constraint accessories_web_country_of_origin_chk
  check (web_country_of_origin is null or web_country_of_origin ~ '^[A-Z]{2}$');

alter table public.accessories
  drop constraint if exists accessories_web_multipack_chk;
alter table public.accessories
  add constraint accessories_web_multipack_chk
  check (web_multipack is null or web_multipack between 2 and 10000);

-- Videót nem tárolunk: csak YouTube link (a 20260546 óta felvett más linkek törlődnek).
update public.accessories
set web_video_url = null
where web_video_url is not null
  and web_video_url !~* '^https://(www\.|m\.)?(youtube\.com|youtu\.be)/';

alter table public.accessories
  drop constraint if exists accessories_web_video_url_chk;
alter table public.accessories
  add constraint accessories_web_video_url_chk
  check (
    web_video_url is null
    or web_video_url ~* '^https://(www\.|m\.)?(youtube\.com|youtu\.be)/'
  );

comment on column public.accessories.web_video_url is
  'YouTube link — a PDP-n kattintásra töltődik (youtube-nocookie), JSON-LD VideoObject.';

comment on column public.accessories.web_country_of_origin is
  'Származási ország, ISO 3166-1 alpha-2 (pl. HU, DE). JSON-LD countryOfOrigin.';
comment on column public.accessories.web_multipack is
  'Több darabos kiszerelés: azonos termékből ennyi db egy eladási egységben (Google multipack).';
comment on column public.accessories.web_is_bundle is
  'Csomagajánlat: több különböző termék egy eladási egységben (Google is_bundle).';

-- ---------------------------------------------------------------------------
-- 2) Kapcsolattípusok
-- ---------------------------------------------------------------------------
alter table public.accessory_related
  drop constraint if exists accessory_related_kind_check;
alter table public.accessory_related
  drop constraint if exists accessory_related_kind_chk;
alter table public.accessory_related
  add constraint accessory_related_kind_chk
  check (kind in ('required', 'accessory', 'alternative', 'larger_pack'));

create index if not exists accessory_related_reverse_idx
  on public.accessory_related (tenant_id, related_id, kind);

comment on column public.accessory_related.kind is
  'required: kell hozzá · accessory: tartozék · alternative: alternatíva (kölcsönös) · larger_pack: nagyobb kiszerelés.';

-- ---------------------------------------------------------------------------
-- 3) Dokumentumok
-- ---------------------------------------------------------------------------
create table if not exists public.accessory_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  accessory_id uuid not null references public.accessories (id) on delete cascade,
  media_id uuid not null references public.media_files (id) on delete cascade,
  kind text not null default 'other',
  title text,
  language text not null default 'hu',
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  constraint accessory_documents_kind_chk check (
    kind in (
      'manual',
      'safety_data_sheet',
      'declaration_of_conformity',
      'datasheet',
      'warranty',
      'certificate',
      'other'
    )
  ),
  constraint accessory_documents_language_chk check (language ~ '^[a-z]{2}$'),
  constraint accessory_documents_title_len check (title is null or char_length(title) <= 200),
  constraint accessory_documents_unique unique (accessory_id, media_id)
);

create index if not exists accessory_documents_tenant_idx
  on public.accessory_documents (tenant_id, accessory_id, sort_order);

create index if not exists accessory_documents_media_idx
  on public.accessory_documents (media_id);

alter table public.accessory_documents enable row level security;

drop policy if exists accessory_documents_select on public.accessory_documents;
drop policy if exists accessory_documents_write on public.accessory_documents;

create policy accessory_documents_select
  on public.accessory_documents for select to authenticated
  using (public.is_tenant_member(tenant_id));

create policy accessory_documents_write
  on public.accessory_documents for all to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

grant select, insert, update, delete on public.accessory_documents to authenticated;

comment on table public.accessory_documents is
  'Termék ↔ PDF (media_files). A PDP „Dokumentumok” szekció és JSON-LD subjectOf forrása.';

-- ---------------------------------------------------------------------------
-- 4) Média: PDF
-- ---------------------------------------------------------------------------
update storage.buckets
set
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
where id = 'tenant-media';

create index if not exists media_files_tenant_mime_idx
  on public.media_files (tenant_id, mime_type, created_at desc);
