-- Optional one-shot: korábban soft-delete-elt beküldött portal ajánlatok → archívum.
-- Így a partner újra látja őket (deleted_at clear + archived_at set).
-- Idempotens: csak ahol deleted_at IS NOT NULL + portal beküldött + nincs order#.

update public.quotes
set
  deleted_at = null,
  archived_at = coalesce(archived_at, deleted_at, now()),
  archived_by_label_snapshot = coalesce(
    archived_by_label_snapshot,
    'restore: soft-delete → archive'
  ),
  updated_at = now()
where source = 'portal'
  and portal_submitted_at is not null
  and order_number is null
  and deleted_at is not null;
