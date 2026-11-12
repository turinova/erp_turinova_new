import type { SupabaseClient } from '@supabase/supabase-js'

import {
  emptyTeyaOnlineSettingsPublic,
  type TeyaOnlineCredentials,
  type TeyaOnlineEnv,
  type TeyaOnlineSettingsPublic
} from '@/lib/teya-online/types'

type TeyaOnlineRow = {
  enabled: boolean
  teya_env: string
  teya_store_id: string | null
  teya_client_id: string | null
  teya_client_secret: string | null
  teya_webhook_public_key: string | null
}

function parseEnv(raw: string | null | undefined): TeyaOnlineEnv {
  return raw === 'production' ? 'production' : 'staging'
}

export function toTeyaOnlinePublic(
  row: TeyaOnlineRow | null
): TeyaOnlineSettingsPublic {
  if (!row) return emptyTeyaOnlineSettingsPublic()
  const storeId = row.teya_store_id?.trim() ?? ''
  const clientId = row.teya_client_id?.trim() ?? ''
  const hasClientSecret = Boolean(row.teya_client_secret?.trim())
  const enabled = Boolean(row.enabled)
  return {
    enabled,
    env: parseEnv(row.teya_env),
    storeId,
    clientId,
    hasClientSecret,
    hasWebhookPublicKey: Boolean(row.teya_webhook_public_key?.trim()),
    ready: enabled && Boolean(storeId && clientId && hasClientSecret)
  }
}

export function credentialsFromRow(
  row: TeyaOnlineRow | null
): TeyaOnlineCredentials | null {
  if (!row) return null
  const storeId = row.teya_store_id?.trim()
  const clientId = row.teya_client_id?.trim()
  const clientSecret = row.teya_client_secret?.trim()
  if (!storeId || !clientId || !clientSecret) return null
  return {
    env: parseEnv(row.teya_env),
    storeId,
    clientId,
    clientSecret
  }
}

export async function getTeyaOnlineSettingsRow(
  supabase: SupabaseClient,
  tenantId: string
): Promise<TeyaOnlineRow | null> {
  const { data, error } = await supabase
    .from('tenant_teya_online_settings')
    .select(
      'enabled, teya_env, teya_store_id, teya_client_id, teya_client_secret, teya_webhook_public_key'
    )
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) {
    // Migration még nincs lefuttatva — ne törje el a partner beállítások oldalt.
    const missing =
      error.code === '42P01' ||
      /does not exist|relation .*tenant_teya_online/i.test(error.message)
    if (missing) {
      console.warn('getTeyaOnlineSettingsRow: table missing', error.message)
      return null
    }
    console.error('getTeyaOnlineSettingsRow', error.message)
    throw new Error('Nem sikerült betölteni a Teya online beállításokat.')
  }
  return (data as TeyaOnlineRow | null) ?? null
}

export async function getTeyaOnlineSettingsPublic(
  supabase: SupabaseClient,
  tenantId: string
): Promise<TeyaOnlineSettingsPublic> {
  const row = await getTeyaOnlineSettingsRow(supabase, tenantId)
  return toTeyaOnlinePublic(row)
}
