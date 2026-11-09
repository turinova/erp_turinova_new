-- Jelenlét: forrás mezőnként (érkezés / távozás külön) — kártya, PIN, kézi, import.
-- A napi `source` + `manually_edited` marad (visszafelé kompatibilis), a UI a mezőnkénti forrást mutatja.

alter table public.hr_attendance_days
  add column if not exists arrival_source text,
  add column if not exists departure_source text;

alter table public.hr_attendance_days
  drop constraint if exists hr_attendance_days_time_source_check;
alter table public.hr_attendance_days
  add constraint hr_attendance_days_time_source_check check (
    (arrival_source is null or arrival_source in ('rfid', 'pin', 'manual', 'import'))
    and (departure_source is null or departure_source in ('rfid', 'pin', 'manual', 'import'))
  );

comment on column public.hr_attendance_days.arrival_source is
  'Érkezés forrása: rfid | pin | manual | import. NULL ha nincs érkezés.';
comment on column public.hr_attendance_days.departure_source is
  'Távozás forrása: rfid | pin | manual | import. NULL ha nincs távozás.';

-- Backfill: a régi napi jelölésből. Terminálos + kézzel módosított napnál nem tudjuk,
-- melyik mezőt írták át → mindkettő kézi (óvatos).
update public.hr_attendance_days
set
  arrival_source = case
    when arrival_time is null then null
    when source = 'terminal' and not manually_edited then 'rfid'
    when source = 'import' and not manually_edited then 'import'
    else 'manual'
  end,
  departure_source = case
    when departure_time is null then null
    when source = 'terminal' and not manually_edited then 'rfid'
    when source = 'import' and not manually_edited then 'import'
    else 'manual'
  end
where arrival_source is null and departure_source is null
  and (arrival_time is not null or departure_time is not null);
