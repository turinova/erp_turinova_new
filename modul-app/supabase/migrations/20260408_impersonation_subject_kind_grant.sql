-- subject_kind column grant (ha 20260407 már lefutott grant nélkül)
-- docs/21-platform-ops.md

grant select (
  id,
  operator_user_id,
  target_user_id,
  tenant_id,
  subject_kind,
  reason,
  expires_at,
  ended_at,
  created_at
) on public.platform_impersonation_sessions to authenticated;
