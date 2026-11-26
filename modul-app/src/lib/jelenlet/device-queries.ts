import type { SupabaseClient } from '@supabase/supabase-js'

import type { JelenletDeviceRow } from '@/lib/jelenlet/types'

export async function listJelenletDevicesForTenant(
  client: SupabaseClient,
  tenantId: string
): Promise<JelenletDeviceRow[]> {
  const base = 'id, tenant_id, slug, name, sync_token_hash, last_seen_at, created_at, updated_at'
  const load = (cols: string) =>
    client
      .from('jelenlet_devices')
      .select(cols)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true })

  let { data, error } = await load(`${base}, last_heartbeat_at, app_version, pending_count`)
  // 20261028 migráció előtt a heartbeat oszlopok még hiányoznak.
  if (error) ({ data, error } = await load(base))

  if (error) {
    console.error('listJelenletDevicesForTenant', error.message)
    return []
  }

  return ((data ?? []) as unknown as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    tenant_id: row.tenant_id as string,
    slug: row.slug as string,
    name: (row.name as string) || (row.slug as string),
    last_seen_at: (row.last_seen_at as string | null) ?? null,
    last_heartbeat_at: (row.last_heartbeat_at as string | null) ?? null,
    app_version: (row.app_version as string | null) ?? null,
    pending_count: (row.pending_count as number | null) ?? null,
    has_token: Boolean(row.sync_token_hash),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string
  }))
}

export function slugifyJelenletDevice(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
}
