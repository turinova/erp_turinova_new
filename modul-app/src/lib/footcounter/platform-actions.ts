'use server'

import { revalidatePath } from 'next/cache'

import {
  generateFootcounterToken,
  grantBelepokPageAccess,
  hashFootcounterToken
} from '@/lib/footcounter/entitlement'
import { FOOTCOUNTER_ADDON_KEY } from '@/lib/footcounter/types'
import { requirePlatformAdmin } from '@/lib/platform/auth'

const TENANTS = '/platform/tenants'

export type FootcounterActionResult =
  | { ok: true; message?: string; token?: string; deviceId?: string }
  | { ok: false; message: string }

function slugify(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
}

export async function createFootcounterDevice(input: {
  tenantId: string
  name: string
  slug?: string
  streamUrl?: string | null
}): Promise<FootcounterActionResult> {
  const ctx = await requirePlatformAdmin()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const name = input.name.trim()
  if (!name) return { ok: false, message: 'Név kötelező.' }

  const slug = slugify(input.slug?.trim() || name) || 'bejarat'
  const token = generateFootcounterToken()
  const tokenHash = hashFootcounterToken(token)
  const streamUrl = input.streamUrl?.trim() || null

  const { data, error } = await ctx.admin
    .from('footcounter_devices')
    .insert({
      tenant_id: input.tenantId,
      slug,
      name,
      sync_token_hash: tokenHash,
      stream_url: streamUrl,
      updated_at: new Date().toISOString()
    })
    .select('id')
    .single()

  if (error || !data?.id) {
    console.error('createFootcounterDevice', error?.message)
    if (error?.code === '23505') {
      return { ok: false, message: 'Ez a slug már foglalt ennél a cégnél.' }
    }
    return { ok: false, message: 'Eszköz létrehozása sikertelen.' }
  }

  revalidatePath(`${TENANTS}/${input.tenantId}`)
  return {
    ok: true,
    message: 'Eszköz létrehozva. Másold ki a tokent — később nem látszik.',
    token,
    deviceId: data.id as string
  }
}

export async function rotateFootcounterDeviceToken(input: {
  tenantId: string
  deviceId: string
}): Promise<FootcounterActionResult> {
  const ctx = await requirePlatformAdmin()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const token = generateFootcounterToken()
  const tokenHash = hashFootcounterToken(token)

  const { data, error } = await ctx.admin
    .from('footcounter_devices')
    .update({
      sync_token_hash: tokenHash,
      updated_at: new Date().toISOString()
    })
    .eq('id', input.deviceId)
    .eq('tenant_id', input.tenantId)
    .select('id')
    .maybeSingle()

  if (error || !data?.id) {
    return { ok: false, message: 'Token csere sikertelen.' }
  }

  revalidatePath(`${TENANTS}/${input.tenantId}`)
  return {
    ok: true,
    message: 'Új token kész. Frissítsd a Pi config.env-et.',
    token,
    deviceId: data.id as string
  }
}

export async function updateFootcounterDevice(input: {
  tenantId: string
  deviceId: string
  name: string
  streamUrl?: string | null
}): Promise<FootcounterActionResult> {
  const ctx = await requirePlatformAdmin()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const name = input.name.trim()
  if (!name) return { ok: false, message: 'Név kötelező.' }

  const { error } = await ctx.admin
    .from('footcounter_devices')
    .update({
      name,
      stream_url: input.streamUrl?.trim() || null,
      updated_at: new Date().toISOString()
    })
    .eq('id', input.deviceId)
    .eq('tenant_id', input.tenantId)

  if (error) {
    return { ok: false, message: 'Mentés sikertelen.' }
  }

  revalidatePath(`${TENANTS}/${input.tenantId}`)
  return { ok: true, message: 'Eszköz mentve.' }
}

export async function deleteFootcounterDevice(input: {
  tenantId: string
  deviceId: string
}): Promise<FootcounterActionResult> {
  const ctx = await requirePlatformAdmin()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const { error } = await ctx.admin
    .from('footcounter_devices')
    .delete()
    .eq('id', input.deviceId)
    .eq('tenant_id', input.tenantId)

  if (error) {
    return { ok: false, message: 'Törlés sikertelen.' }
  }

  revalidatePath(`${TENANTS}/${input.tenantId}`)
  return { ok: true, message: 'Eszköz törölve.' }
}

/** Called from setTenantAddon when footcounter is enabled. */
export async function onFootcounterAddonEnabled(
  admin: Parameters<typeof grantBelepokPageAccess>[0],
  tenantId: string
) {
  await grantBelepokPageAccess(admin, tenantId)
}

export async function resolveFootcounterAddonId(
  admin: Parameters<typeof grantBelepokPageAccess>[0]
): Promise<string | null> {
  const { data } = await admin
    .from('product_addons')
    .select('id')
    .eq('key', FOOTCOUNTER_ADDON_KEY)
    .maybeSingle()
  return (data?.id as string | undefined) ?? null
}
