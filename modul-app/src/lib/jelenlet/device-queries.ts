import type { SupabaseClient } from '@supabase/supabase-js'

import type { JelenletDeviceRow } from '@/lib/jelenlet/types'

export async function listJelenletDevicesForTenant(
  client: SupabaseClient,
  tenantId: string
): Promise<JelenletDeviceRow[]> {
  const { data, error } = await client
    .from('jelenlet_devices')
    .select(
      'id, tenant_id, slug, name, sync_token_hash, last_seen_at, created_at, updated_at'
    )
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('listJelenletDevicesForTenant', error.message)
    return []
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    tenant_id: row.tenant_id as string,
    slug: row.slug as string,
    name: (row.name as string) || (row.slug as string),
    last_seen_at: (row.last_seen_at as string | null) ?? null,
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
