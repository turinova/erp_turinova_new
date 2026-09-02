-- Calendar day kinds for Hungarian relocated workdays / rest days
-- national | company = classic holidays (rest)
-- relocated_workday = áthelyezett munkanap (often Saturday that becomes mandatory work)
-- relocated_rest = áthelyezett pihenőnap (weekday that becomes free)

alter table public.holidays
  drop constraint if exists holidays_type_check;

alter table public.holidays
  add constraint holidays_type_check
  check (type in ('national', 'company', 'relocated_workday', 'relocated_rest'));

comment on column public.holidays.type is
  'national|company = pihenő; relocated_workday = áthelyezett munkanap; relocated_rest = áthelyezett pihenőnap';
