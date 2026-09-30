'use server'

import { revalidatePath } from 'next/cache'

import {
  generateJelenletToken,
  hashJelenletToken
} from '@/lib/jelenlet/entitlement'
import { slugifyJelenletDevice } from '@/lib/jelenlet/device-queries'
import { requirePlatformAdmin } from '@/lib/platform/auth'

const TENANTS = '/platform/tenants'

export type JelenletDeviceActionResult =
  | { ok: true; message?: string; token?: string; deviceId?: string }
  | { ok: false; message: string }

export async function createJelenletDevicePlatform(input: {
  tenantId: string
  name: string
  slug?: string
}): Promise<JelenletDeviceActionResult> {
  const ctx = await requirePlatformAdmin()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const name = input.name.trim()
  if (!name) return { ok: false, message: 'Név kötelező.' }

  const slug = slugifyJelenletDevice(input.slug?.trim() || name) || 'terminal'
  const token = generateJelenletToken()
  const tokenHash = hashJelenletToken(token)

  const { data, error } = await ctx.admin
    .from('jelenlet_devices')
    .insert({
      tenant_id: input.tenantId,
      slug,
      name,
      sync_token_hash: tokenHash,
      updated_at: new Date().toISOString()
    })
    .select('id')
    .single()

  if (error || !data?.id) {
    console.error('createJelenletDevicePlatform', error?.message)
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

export async function rotateJelenletDeviceTokenPlatform(input: {
  tenantId: string
  deviceId: string
}): Promise<JelenletDeviceActionResult> {
  const ctx = await requirePlatformAdmin()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const token = generateJelenletToken()
  const tokenHash = hashJelenletToken(token)

  const { data, error } = await ctx.admin
    .from('jelenlet_devices')
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
    message: 'Új token kész. Frissítsd a Pi környezetet.',
    token,
    deviceId: data.id as string
  }
}

export async function updateJelenletDevicePlatform(input: {
  tenantId: string
  deviceId: string
  name: string
}): Promise<JelenletDeviceActionResult> {
  const ctx = await requirePlatformAdmin()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const name = input.name.trim()
  if (!name) return { ok: false, message: 'Név kötelező.' }

  const { error } = await ctx.admin
    .from('jelenlet_devices')
    .update({
      name,
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

export async function deleteJelenletDevicePlatform(input: {
  tenantId: string
  deviceId: string
}): Promise<JelenletDeviceActionResult> {
  const ctx = await requirePlatformAdmin()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const { error } = await ctx.admin
    .from('jelenlet_devices')
    .delete()
    .eq('id', input.deviceId)
    .eq('tenant_id', input.tenantId)

  if (error) {
    return { ok: false, message: 'Törlés sikertelen.' }
  }

  revalidatePath(`${TENANTS}/${input.tenantId}`)
  return { ok: true, message: 'Eszköz törölve.' }
}
