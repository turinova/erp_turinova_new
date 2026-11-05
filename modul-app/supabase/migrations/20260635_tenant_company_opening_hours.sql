-- Cég nyitvatartás (partner kezdőlap „Most nyitva / Zárva” + heti táblázat).
-- opening_hours: { "mon": [{"from":"07:00","to":"16:00"}], …, "sun": [] }
-- Hiányzó nap / üres tömb = zárva. null = nincs megadva (nem jelenik meg).

alter table public.tenant_companies
  add column if not exists opening_hours jsonb,
  add column if not exists opening_hours_note text;

alter table public.tenant_companies
  drop constraint if exists tenant_companies_opening_hours_object;
alter table public.tenant_companies
  add constraint tenant_companies_opening_hours_object
  check (opening_hours is null or jsonb_typeof(opening_hours) = 'object');

alter table public.tenant_companies
  drop constraint if exists tenant_companies_opening_hours_note_len;
alter table public.tenant_companies
  add constraint tenant_companies_opening_hours_note_len
  check (opening_hours_note is null or char_length(opening_hours_note) <= 300);

comment on column public.tenant_companies.opening_hours is
  'Heti nyitvatartás: mon..sun → [{from,to}] (HH:MM, Europe/Budapest). null = nincs megadva.';
comment on column public.tenant_companies.opening_hours_note is
  'Ünnepi / rendkívüli nyitvatartás szöveg (partner kezdőlapon kiemelve).';
