'use server'

import { revalidatePath } from 'next/cache'

import { testTeyaOnlineCredentials } from '@/lib/teya-online/client'
import { getTeyaOnlineSettingsRow } from '@/lib/teya-online/queries'
import type {
  TeyaOnlineCredentials,
  TeyaOnlineEnv
} from '@/lib/teya-online/types'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'
import type { SupabaseClient } from '@supabase/supabase-js'

const SETTINGS_PATH = '/beallitasok/partner'

export type TeyaOnlineActionResult =
  | { ok: true; message?: string }
  | { ok: false; message: string }

async function tenantHasPartnerOrders(
  supabase: SupabaseClient,
  tenantId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('tenant_entitlements')
    .select('feature_key')
    .eq('tenant_id', tenantId)
    .eq('feature_key', 'partner_orders')
    .maybeSingle()
  if (error) {
    console.error('tenantHasPartnerOrders (teya)', error.message)
    return false
  }
  return Boolean(data)
}

function parseEnv(raw: string): TeyaOnlineEnv | null {
  if (raw === 'staging' || raw === 'production') return raw
  return null
}

export async function saveTeyaOnlineSettingsAction(input: {
  enabled: boolean
  env: string
  storeId: string
  clientId: string
  /** Üres = megtartjuk a meglévő secretet. */
  clientSecret: string
  webhookPublicKey?: string
}): Promise<TeyaOnlineActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const tenantId = ctx.user.tenantId!
  if (!(await tenantHasPartnerOrders(ctx.supabase, tenantId))) {
    return {
      ok: false,
      message:
        'Az Online partner rendelés add-on nincs bekapcsolva ennél a cégnél.'
    }
  }

  const env = parseEnv(input.env)
  if (!env) {
    return { ok: false, message: 'Érvénytelen Teya környezet (teszt / éles).' }
  }

  const storeId = input.storeId.trim() || null
  const clientId = input.clientId.trim() || null
  const secretInput = input.clientSecret.trim()

  const existing = await getTeyaOnlineSettingsRow(ctx.supabase, tenantId)
  const secret = secretInput || existing?.teya_client_secret?.trim() || null

  if (input.enabled) {
    if (!storeId || !clientId || !secret) {
      return {
        ok: false,
        message:
          'A bekapcsoláshoz kell az üzlet azonosító, a kliens azonosító és a titkos kulcs.'
      }
    }
  }

  const webhookKey =
    input.webhookPublicKey !== undefined
      ? input.webhookPublicKey.trim() || null
      : (existing?.teya_webhook_public_key ?? null)

  const { error } = await ctx.supabase
    .from('tenant_teya_online_settings')
    .upsert(
      {
        tenant_id: tenantId,
        enabled: Boolean(input.enabled),
        teya_env: env,
        teya_store_id: storeId,
        teya_client_id: clientId,
        teya_client_secret: secret,
        teya_webhook_public_key: webhookKey,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'tenant_id' }
    )

  if (error) {
    console.error('saveTeyaOnlineSettingsAction', error.message)
    return {
      ok: false,
      message: 'Nem sikerült menteni a Teya online beállításokat.'
    }
  }

  revalidatePath(SETTINGS_PATH)
  return { ok: true, message: 'Teya online beállítások mentve.' }
}

/**
 * Kapcsolat-teszt: OAuth ecommerce scope + checkout session GET smoke.
 * Formról beírt secret felülírja a mentettet a teszthez (nem ment automatikusan).
 */
export async function testTeyaOnlineConnectionAction(input?: {
  env?: string
  storeId?: string
  clientId?: string
  clientSecret?: string
}): Promise<TeyaOnlineActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const tenantId = ctx.user.tenantId!
  const existing = await getTeyaOnlineSettingsRow(ctx.supabase, tenantId)

  const env =
    parseEnv(input?.env ?? '') ??
    (existing?.teya_env === 'production' ? 'production' : existing ? 'staging' : null)
  const storeId =
    input?.storeId?.trim() || existing?.teya_store_id?.trim() || ''
  const clientId =
    input?.clientId?.trim() || existing?.teya_client_id?.trim() || ''
  const clientSecret =
    input?.clientSecret?.trim() ||
    existing?.teya_client_secret?.trim() ||
    ''

  if (!env || !storeId || !clientId || !clientSecret) {
    return {
      ok: false,
      message:
        'Előbb add meg és mentsd el a Teya online üzlet / kliens / titkos kulcs adatokat.'
    }
  }

  const creds: TeyaOnlineCredentials = {
    env,
    storeId,
    clientId,
    clientSecret
  }

  const result = await testTeyaOnlineCredentials(creds)
  if (!result.ok) return { ok: false, message: result.message }
  return { ok: true, message: result.message }
}
