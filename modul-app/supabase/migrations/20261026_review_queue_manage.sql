-- Köszönő SMS sor kezelése: halasztás, törlés (okkal), napló
-- Docs: 55-google-cegprofil.md · Előfeltétel: 20261004_review_requests.sql
-- Nincs „rossz vélemény” törlési ok: a szelektív (csak elégedetteknek szóló) kérést a Google tiltja.

alter table public.review_request_queue
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references auth.users (id) on delete set null,
  add column if not exists cancel_reason text,
  add column if not exists cancel_note text,
  add column if not exists postponed_count integer not null default 0;

alter table public.review_request_queue
  drop constraint if exists review_request_queue_status_chk;
alter table public.review_request_queue
  add constraint review_request_queue_status_chk
  check (status in ('pending', 'sent', 'skipped', 'failed', 'cancelled'));

alter table public.review_request_queue
  drop constraint if exists review_request_queue_cancel_reason_chk;
alter table public.review_request_queue
  add constraint review_request_queue_cancel_reason_chk
  check (
    cancel_reason is null
    or cancel_reason in ('customer_request', 'wrong_contact', 'not_recipient', 'duplicate', 'other')
  );

alter table public.review_request_queue
  drop constraint if exists review_request_queue_postponed_chk;
alter table public.review_request_queue
  add constraint review_request_queue_postponed_chk
  check (postponed_count between 0 and 3);

alter table public.review_request_queue
  drop constraint if exists review_request_queue_cancel_note_chk;
alter table public.review_request_queue
  add constraint review_request_queue_cancel_note_chk
  check (cancel_note is null or char_length(cancel_note) <= 200);

comment on column public.review_request_queue.cancel_reason is
  'customer_request | wrong_contact | not_recipient | duplicate | other';
comment on column public.review_request_queue.postponed_count is
  'Halasztások száma (max 3).';

create index if not exists review_request_queue_tenant_status_idx
  on public.review_request_queue (tenant_id, status, send_after);

drop policy if exists review_request_queue_update_writer on public.review_request_queue;
create policy review_request_queue_update_writer
  on public.review_request_queue for update to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));
