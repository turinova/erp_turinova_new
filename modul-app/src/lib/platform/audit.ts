import type { SupabaseClient } from '@supabase/supabase-js'

export async function writePlatformAudit(
  admin: SupabaseClient,
  input: {
    tenantId?: string | null
    actorUserId?: string | null
    action: string
    details?: Record<string, unknown>
  }
): Promise<void> {
  const { error } = await admin.from('platform_audit_log').insert({
    tenant_id: input.tenantId ?? null,
    actor_user_id: input.actorUserId ?? null,
    action: input.action,
    details: input.details ?? {}
  })
  if (error) {
    console.error('writePlatformAudit', error.message)
  }
}

export type PlatformAuditRow = {
  id: string
  tenant_id: string | null
  actor_user_id: string | null
  action: string
  details: Record<string, unknown>
  created_at: string
  actor_email?: string | null
}

export async function listTenantPlatformAudit(
  admin: SupabaseClient,
  tenantId: string,
  limit = 50
): Promise<PlatformAuditRow[]> {
  const { data, error } = await admin
    .from('platform_audit_log')
    .select('id, tenant_id, actor_user_id, action, details, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('listTenantPlatformAudit', error.message)
    return []
  }

  const rows = data ?? []
  const actorIds = [
    ...new Set(
      rows
        .map((r) => r.actor_user_id)
        .filter((id): id is string => Boolean(id))
    )
  ]

  const emailById = new Map<string, string>()
  if (actorIds.length > 0) {
    const { getAuthUsersByIds } = await import('@/lib/platform/auth-users')
    const users = await getAuthUsersByIds(admin, actorIds)
    for (const [id, u] of users) {
      if (u.email) emailById.set(id, u.email)
    }
  }

  return rows.map((r) => ({
    id: r.id,
    tenant_id: r.tenant_id,
    actor_user_id: r.actor_user_id,
    action: r.action,
    details: (r.details ?? {}) as Record<string, unknown>,
    created_at: r.created_at,
    actor_email: r.actor_user_id
      ? emailById.get(r.actor_user_id) ?? null
      : null
  }))
}
