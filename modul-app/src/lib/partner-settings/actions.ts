'use server'

import { revalidatePath } from 'next/cache'

import {
  defaultPartnerSearchKinds,
  invalidateTenantPartnerSettingsCache,
  type PartnerSearchKinds
} from '@/lib/partner-settings/queries'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'
import type { SupabaseClient } from '@supabase/supabase-js'

const SETTINGS_PATH = '/beallitasok/partner'

export type PartnerSettingsActionResult =
  | { ok: true }
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
    console.error('tenantHasPartnerOrders', error.message)
    return false
  }
  return Boolean(data)
}

export async function updatePartnerSearchKinds(input: {
  searchSheet: boolean
  searchLinear: boolean
  searchAccessory: boolean
}): Promise<PartnerSettingsActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const tenantId = ctx.user.tenantId!
  const hasAddon = await tenantHasPartnerOrders(ctx.supabase, tenantId)
  if (!hasAddon) {
    return {
      ok: false,
      message:
        'Az Online partner rendelés add-on nincs bekapcsolva ennél a cégnél.'
    }
  }

  const kinds: PartnerSearchKinds = {
    sheet: Boolean(input.searchSheet),
    linear: Boolean(input.searchLinear),
    accessory: Boolean(input.searchAccessory)
  }

  if (!kinds.sheet && !kinds.linear && !kinds.accessory) {
    return {
      ok: false,
      message: 'Legalább egy keresési típust válassz.'
    }
  }

  const { error } = await ctx.supabase.from('tenant_partner_settings').upsert(
    {
      tenant_id: tenantId,
      search_sheet: kinds.sheet,
      search_linear: kinds.linear,
      search_accessory: kinds.accessory,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'tenant_id' }
  )

  if (error) {
    console.error('updatePartnerSearchKinds', error.message)
    return { ok: false, message: 'Nem sikerült menteni a beállításokat.' }
  }

  invalidateTenantPartnerSettingsCache(tenantId)
  revalidatePath(SETTINGS_PATH)
  revalidatePath('/partner/kereso')
  return { ok: true }
}

/** Lazy default sor, ha még nincs (addon bekapcsolás után). */
export async function ensurePartnerSettingsRow(): Promise<PartnerSearchKinds> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return defaultPartnerSearchKinds()

  const tenantId = ctx.user.tenantId!
  const { data } = await ctx.supabase
    .from('tenant_partner_settings')
    .select('search_sheet, search_linear, search_accessory')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (data) {
    return {
      sheet: Boolean(data.search_sheet),
      linear: Boolean(data.search_linear),
      accessory: Boolean(data.search_accessory)
    }
  }

  const defaults = defaultPartnerSearchKinds()
  await ctx.supabase.from('tenant_partner_settings').upsert(
    {
      tenant_id: tenantId,
      search_sheet: defaults.sheet,
      search_linear: defaults.linear,
      search_accessory: defaults.accessory
    },
    { onConflict: 'tenant_id' }
  )
  invalidateTenantPartnerSettingsCache(tenantId)
  return defaults
}
