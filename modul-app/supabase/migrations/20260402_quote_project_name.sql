-- modul-app: opcionális projektnév az Opti ajánlatokon
-- Depends on: quotes

alter table public.quotes
  add column if not exists project_name text;

comment on column public.quotes.project_name is
  'Opcionális projektnév (Opti) — pl. Konyha – Kovács; nem a comment mező.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'quotes_project_name_len_check'
  ) then
    alter table public.quotes
      add constraint quotes_project_name_len_check
      check (project_name is null or char_length(project_name) <= 120);
  end if;
end $$;
