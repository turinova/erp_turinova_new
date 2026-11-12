-- Projektnév max 40 karakter (lista / cím olvashatóság).
-- Depends on: 20260402_quote_project_name.sql

update public.quotes
set project_name = left(btrim(project_name), 40)
where project_name is not null
  and char_length(btrim(project_name)) > 40;

update public.quotes
set project_name = null
where project_name is not null
  and btrim(project_name) = '';

alter table public.quotes
  drop constraint if exists quotes_project_name_len_check;

alter table public.quotes
  add constraint quotes_project_name_len_check
  check (project_name is null or char_length(project_name) <= 40);

comment on column public.quotes.project_name is
  'Opcionális projektnév (Opti) — max 40 karakter; nem a comment mező; PDF-en nem.';
