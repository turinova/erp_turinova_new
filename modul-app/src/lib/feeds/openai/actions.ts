'use server'

import { revalidatePath } from 'next/cache'

import { newFeedToken } from '@/lib/feeds/openai/load'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'

export type FeedActionResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

export type OpenAiFeedInput = {
  enabled: boolean
  siteBaseUrl: string
  sheetPath: string
  linearPath: string
  country: string
  pickupText: string
  returnPolicyUrl: string
  returnDays: number
}

const PAGE = '/beallitasok/feedek'

function migrationMessage(code: string | undefined, fallback: string) {
  return code === '42P01' || code === '42703' ? 'Futtasd a 20261031_product_feeds.sql migrációt.' : fallback
}

function normPath(p: string, fallback: string) {
  const t = p.trim().replace(/^\/+|\/+$/g, '')
  return t ? `/${t}` : fallback
}

export async function saveOpenAiFeedAction(input: OpenAiFeedInput): Promise<FeedActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const fieldErrors: Record<string, string> = {}
  const base = input.siteBaseUrl.trim().replace(/\/+$/, '')
  if (!/^https:\/\/[^\s/]+\.[^\s/]+/i.test(base)) fieldErrors.siteBaseUrl = 'https:// kezdetű weboldal cím kell.'
  const returnUrl = input.returnPolicyUrl.trim()
  if (returnUrl && !/^https:\/\//i.test(returnUrl)) fieldErrors.returnPolicyUrl = 'https:// kezdetű link kell.'
  const country = input.country.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(country)) fieldErrors.country = 'Kétbetűs országkód, pl. HU.'
  const days = Math.round(Number(input.returnDays))
  if (!Number.isFinite(days) || days < 0 || days > 365) fieldErrors.returnDays = '0 és 365 közötti szám.'
  if (input.pickupText.trim().length > 500) fieldErrors.pickupText = 'Legfeljebb 500 karakter.'
  if (Object.keys(fieldErrors).length) {
    return { ok: false, message: 'Ellenőrizd a megadott adatokat.', fieldErrors }
  }

  const tenantId = ctx.user.tenantId!
  const values = {
    enabled: input.enabled,
    site_base_url: base,
    sheet_path: normPath(input.sheetPath, '/butorlap'),
    linear_path: normPath(input.linearPath, '/munkalap'),
    country,
    currency: 'HUF',
    pickup_text: input.pickupText.trim(),
    return_policy_url: returnUrl,
    return_days: days,
    updated_at: new Date().toISOString()
  }

  const { data: existing, error: readError } = await ctx.supabase
    .from('product_feeds')
    .select('token')
    .eq('tenant_id', tenantId)
    .eq('kind', 'openai')
    .maybeSingle()
  if (readError) {
    console.error('saveOpenAiFeedAction', readError.message)
    return { ok: false, message: migrationMessage(readError.code, 'Nem sikerült menteni.') }
  }

  const { error } = existing
    ? await ctx.supabase.from('product_feeds').update(values).eq('tenant_id', tenantId).eq('kind', 'openai')
    : await ctx.supabase
        .from('product_feeds')
        .insert({ ...values, tenant_id: tenantId, kind: 'openai', token: newFeedToken() })
  if (error) {
    console.error('saveOpenAiFeedAction', error.message)
    return { ok: false, message: migrationMessage(error.code, 'Nem sikerült menteni.') }
  }

  revalidatePath(PAGE)
  return { ok: true }
}

export async function regenerateOpenAiFeedTokenAction(): Promise<FeedActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  const { error } = await ctx.supabase
    .from('product_feeds')
    .update({ token: newFeedToken(), updated_at: new Date().toISOString() })
    .eq('tenant_id', ctx.user.tenantId!)
    .eq('kind', 'openai')
  if (error) {
    console.error('regenerateOpenAiFeedTokenAction', error.message)
    return { ok: false, message: 'Nem sikerült új linket készíteni.' }
  }
  revalidatePath(PAGE)
  return { ok: true }
}

export async function setFeedExcludedAction(
  kind: 'sheet' | 'linear',
  id: string,
  excluded: boolean
): Promise<FeedActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  const { error } = await ctx.supabase
    .from(kind === 'sheet' ? 'sheet_materials' : 'linear_materials')
    .update({ feed_excluded: excluded })
    .eq('tenant_id', ctx.user.tenantId!)
    .eq('id', id)
  if (error) {
    console.error('setFeedExcludedAction', error.message)
    return { ok: false, message: migrationMessage(error.code, 'Nem sikerült módosítani.') }
  }
  revalidatePath(PAGE)
  return { ok: true }
}
