'use server'

import { randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'

import { requirePlatformAdmin } from '@/lib/platform/auth'
import { slugifyTenantName } from '@/lib/platform/onboarding'
import { seedOwnerPageAccess } from '@/lib/platform/queries'
import type { TenantStatus } from '@/lib/supabase/database.types'

export type PlatformActionResult =
  | { ok: true; tenantId?: string }
  | { ok: false; message: string }

const PLATFORM_PATH = '/platform'
const TENANTS_PATH = '/platform/tenants'

export async function createPlatformTenant(input: {
  name: string
  slug?: string
  ownerEmail: string
  ownerPassword: string
  seedTaxRates?: boolean
}): Promise<PlatformActionResult> {
  const ctx = await requirePlatformAdmin()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const name = input.name.trim()
  if (name.length < 2) {
    return { ok: false, message: 'A cégnév legalább 2 karakter legyen.' }
  }

  const slug = (input.slug?.trim() || slugifyTenantName(name)).toLowerCase()
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return {
      ok: false,
      message: 'A slug csak kisbetűt, számot és kötőjelet tartalmazhat.'
    }
  }

  const email = input.ownerEmail.trim().toLowerCase()
  const password = input.ownerPassword
  if (!email.includes('@')) {
    return { ok: false, message: 'Érvényes owner email kell.' }
  }
  if (password.length < 8) {
    return { ok: false, message: 'A jelszó legalább 8 karakter legyen.' }
  }

  const admin = ctx.admin

  const { data: existingSlug } = await admin
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()
  if (existingSlug) {
    return { ok: false, message: 'Ez a slug már foglalt.' }
  }

  const { data: tenant, error: tenantError } = await admin
    .from('tenants')
    .insert({
      name,
      slug,
      status: 'provisioning',
      max_seats: 10
    })
    .select('id')
    .single()

  if (tenantError || !tenant) {
    console.error('createPlatformTenant', tenantError?.message)
    return { ok: false, message: 'Nem sikerült létrehozni a céget.' }
  }

  const tenantId = tenant.id

  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })

  if (createError || !created.user) {
    await admin.from('tenants').delete().eq('id', tenantId)
    const msg = createError?.message ?? ''
    if (msg.toLowerCase().includes('already') || msg.includes('registered')) {
      return {
        ok: false,
        message:
          'Ez az email már létezik. Használj új emailt, vagy kösd SQL-lel a meglévő usert.'
      }
    }
    return { ok: false, message: 'Owner felhasználó létrehozása sikertelen.' }
  }

  const userId = created.user.id

  const { data: membership, error: memError } = await admin
    .from('tenant_memberships')
    .insert({
      tenant_id: tenantId,
      user_id: userId,
      role: 'owner'
    })
    .select('id')
    .single()

  if (memError || !membership) {
    await admin.auth.admin.deleteUser(userId)
    await admin.from('tenants').delete().eq('id', tenantId)
    return { ok: false, message: 'Owner tagság létrehozása sikertelen.' }
  }

  try {
    const { assignDefaultPlanAndMaterialize } = await import(
      '@/lib/platform/entitlement-actions'
    )
    await assignDefaultPlanAndMaterialize(admin, tenantId, ctx.user.id)
  } catch (e) {
    console.error('createPlatformTenant entitlements', e)
  }

  try {
    await seedOwnerPageAccess(admin, tenantId, membership.id)
  } catch {
    // continue — can fix in Felhasználók
  }

  await admin.from('tenant_onboarding').upsert({
    tenant_id: tenantId,
    updated_at: new Date().toISOString()
  })

  if (input.seedTaxRates !== false) {
    await admin.from('tax_rates').insert([
      {
        tenant_id: tenantId,
        name: 'ÁFA 0%',
        rate_percent: 0,
        is_default: false
      },
      {
        tenant_id: tenantId,
        name: 'ÁFA 27%',
        rate_percent: 27,
        is_default: true
      }
    ])
  }

  await admin
    .from('tenants')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', tenantId)

  revalidatePath(PLATFORM_PATH)
  revalidatePath(TENANTS_PATH)
  return { ok: true, tenantId }
}

export async function updatePlatformTenantStatus(input: {
  tenantId: string
  status: TenantStatus
}): Promise<PlatformActionResult> {
  const ctx = await requirePlatformAdmin()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const allowed: TenantStatus[] = [
    'provisioning',
    'active',
    'read_only',
    'suspended',
    'churned'
  ]
  if (!allowed.includes(input.status)) {
    return { ok: false, message: 'Érvénytelen státusz.' }
  }

  const { error } = await ctx.admin
    .from('tenants')
    .update({
      status: input.status,
      updated_at: new Date().toISOString()
    })
    .eq('id', input.tenantId)

  if (error) {
    console.error('updatePlatformTenantStatus', error.message)
    return { ok: false, message: 'Nem sikerült frissíteni a státuszt.' }
  }

  revalidatePath(PLATFORM_PATH)
  revalidatePath(TENANTS_PATH)
  revalidatePath(`${TENANTS_PATH}/${input.tenantId}`)
  return { ok: true }
}

export async function refreshTenantOnboardingFlags(
  tenantId: string
): Promise<PlatformActionResult> {
  const ctx = await requirePlatformAdmin()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const admin = ctx.admin

  const [
    { count: companyCount },
    { count: sheetCount },
    { count: edgeCount },
    { count: quoteCount },
    { count: orderCount }
  ] = await Promise.all([
    admin
      .from('tenant_companies')
      .select('tenant_id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId),
    admin
      .from('sheet_materials')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('deleted_at', null),
    admin
      .from('edge_materials')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('deleted_at', null),
    admin
      .from('quotes')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('deleted_at', null),
    admin
      .from('quotes')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .not('order_number', 'is', null)
      .is('deleted_at', null)
  ])

  const { data: existing } = await admin
    .from('tenant_onboarding')
    .select('first_login_at')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  const { error } = await admin.from('tenant_onboarding').upsert({
    tenant_id: tenantId,
    company_profile_done: (companyCount ?? 0) > 0,
    has_sheet_material: (sheetCount ?? 0) > 0,
    has_edge_material: (edgeCount ?? 0) > 0,
    has_quote: (quoteCount ?? 0) > 0,
    has_order: (orderCount ?? 0) > 0,
    first_login_at: existing?.first_login_at ?? null,
    updated_at: new Date().toISOString()
  })

  if (error) {
    console.error('refreshTenantOnboardingFlags', error.message)
    return { ok: false, message: 'Nem sikerült frissíteni az onboardingot.' }
  }

  revalidatePath(`${TENANTS_PATH}/${tenantId}`)
  revalidatePath(TENANTS_PATH)
  revalidatePath(PLATFORM_PATH)
  return { ok: true }
}

function generateTempPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = randomBytes(14)
  let out = ''
  for (const b of bytes) {
    out += alphabet[b % alphabet.length]
  }
  return `${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8, 12)}-${out.slice(12)}`
}

export type ResetPasswordResult =
  | { ok: true; temporaryPassword: string; email: string }
  | { ok: false; message: string }

/** Platform: ideiglenes jelszó beállítása (Auth update). */
export async function resetTenantUserPassword(input: {
  tenantId: string
  userId: string
}): Promise<ResetPasswordResult> {
  const ctx = await requirePlatformAdmin()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const { data: membership, error: memError } = await ctx.admin
    .from('tenant_memberships')
    .select('id, role')
    .eq('tenant_id', input.tenantId)
    .eq('user_id', input.userId)
    .maybeSingle()

  if (memError || !membership) {
    return { ok: false, message: 'A felhasználó nem tagja ennek a cégnek.' }
  }

  const temporaryPassword = generateTempPassword()
  const { data: updated, error } = await ctx.admin.auth.admin.updateUserById(
    input.userId,
    { password: temporaryPassword }
  )

  if (error || !updated.user) {
    console.error('resetTenantUserPassword', error?.message)
    return { ok: false, message: 'Nem sikerült a jelszó reset.' }
  }

  // Új jelszó után minden app-session érvénytelen
  await ctx.admin
    .from('app_user_sessions')
    .delete()
    .eq('user_id', input.userId)

  revalidatePath(`${TENANTS_PATH}/${input.tenantId}`)
  return {
    ok: true,
    temporaryPassword,
    email: updated.user.email ?? ''
  }
}

export async function updateTenantMaxSeats(input: {
  tenantId: string
  maxSeats: number | null
}): Promise<PlatformActionResult> {
  const ctx = await requirePlatformAdmin()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  if (input.maxSeats !== null) {
    if (!Number.isInteger(input.maxSeats) || input.maxSeats < 1) {
      return { ok: false, message: 'A limit legalább 1 legyen, vagy üres (korlátlan).' }
    }
    if (input.maxSeats > 500) {
      return { ok: false, message: 'A limit maximum 500.' }
    }
  }

  const { count } = await ctx.admin
    .from('tenant_memberships')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', input.tenantId)

  if (
    input.maxSeats !== null &&
    count !== null &&
    count > input.maxSeats
  ) {
    return {
      ok: false,
      message: `Már ${count} tag van — a limit nem lehet kisebb.`
    }
  }

  const { error } = await ctx.admin
    .from('tenants')
    .update({
      max_seats: input.maxSeats,
      updated_at: new Date().toISOString()
    })
    .eq('id', input.tenantId)

  if (error) {
    console.error('updateTenantMaxSeats', error.message)
    return { ok: false, message: 'Nem sikerült menteni a limitt.' }
  }

  revalidatePath(`${TENANTS_PATH}/${input.tenantId}`)
  revalidatePath(TENANTS_PATH)
  return { ok: true }
}