-- CSO SMS ledger: rendelés link a naplóhoz / számlázási audithoz

alter table public.sms_send_events
  add column if not exists customer_special_order_id uuid
    references public.customer_special_orders (id) on delete set null;

create index if not exists sms_send_events_cso_idx
  on public.sms_send_events (customer_special_order_id)
  where customer_special_order_id is not null;

comment on column public.sms_send_events.customer_special_order_id is
  'Ügyfélrendelés SMS (cso_ready) hivatkozás — quote_id helyett.';
