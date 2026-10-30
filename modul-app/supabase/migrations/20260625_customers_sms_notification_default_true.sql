-- Új ügyfél: SMS értesítés default ON (készre SMS flow).
-- Meglévő sorokat nem backfilleljük.

alter table public.customers
  alter column sms_notification set default true;

comment on column public.customers.sms_notification is
  'Készre állításkor SMS küldhető (ha van SMS add-on). Új ügyfélnél default ON; kikapcsolható.';
