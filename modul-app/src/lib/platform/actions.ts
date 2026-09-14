'use server'

import { randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'

import { requirePlatformAdmin } from '@/lib/platform/auth'
import { writePlatformAudit } from '@/lib/platform/audit'
import { slugifyTenantName } from '@/lib/platform/onboarding'
import { seedOwnerPageAccess } from '@/lib/platform/queries'
import type { TenantStatus } from '@/lib/supabase/database.types'

export type PlatformActionResult =
  | { ok: true; tenantId?: string; message?: string }
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

  await writePlatformAudit(ctx.admin, {
    tenantId: input.tenantId,
    actorUserId: ctx.user.id,
    action: 'tenant.status',
    details: { status: input.status }
  })

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

  await ctx.admin
    .from('app_user_sessions')
    .delete()
    .eq('user_id', input.userId)

  await writePlatformAudit(ctx.admin, {
    tenantId: input.tenantId,
    actorUserId: ctx.user.id,
    action: 'user.password_reset',
    details: { userId: input.userId, email: updated.user.email ?? null }
  })

  revalidatePath(`${TENANTS_PATH}/${input.tenantId}`)
  return {
    ok: true,
    temporaryPassword,
    email: updated.user.email ?? ''
  }
}

/**
 * Supabase Auth email: recovery (jelszó reset) vagy invite újraküldés.
 * generateLink a tokenhez; a kézbesítés Auth template-en megy.
 */
export async function sendTenantUserAuthEmail(input: {
  tenantId: string
  userId: string
  mode?: 'auto' | 'recovery' | 'invite'
}): Promise<PlatformActionResult> {
  const ctx = await requirePlatformAdmin()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const { data: membership, error: memError } = await ctx.admin
    .from('tenant_memberships')
    .select('id')
    .eq('tenant_id', input.tenantId)
    .eq('user_id', input.userId)
    .maybeSingle()

  if (memError || !membership) {
    return { ok: false, message: 'A felhasználó nem tagja ennek a cégnek.' }
  }

  const {
    data: { user },
    error: userError
  } = await ctx.admin.auth.admin.getUserById(input.userId)

  if (userError || !user?.email) {
    return { ok: false, message: 'Felhasználó nem található.' }
  }

  const redirectTo =
    process.env.NEXT_PUBLIC_APP_ORIGIN?.replace(/\/$/, '') ||
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
  const redirectLogin = redirectTo ? `${redirectTo}/login` : undefined

  const mode =
    input.mode === 'auto' || !input.mode
      ? user.email_confirmed_at
        ? 'recovery'
        : 'invite'
      : input.mode

  if (mode === 'invite') {
    const { error } = await ctx.admin.auth.admin.inviteUserByEmail(user.email, {
      redirectTo: redirectLogin
    })
    if (error) {
      // Already registered → try recovery instead
      if (/already|registered|exists/i.test(error.message)) {
        const { error: recError } = await ctx.admin.auth.resetPasswordForEmail(
          user.email,
          { redirectTo: redirectLogin }
        )
        if (recError) {
          console.error('sendTenantUserAuthEmail invite→recovery', recError.message)
          return { ok: false, message: 'Nem sikerült az Auth email küldése.' }
        }
      } else {
        console.error('sendTenantUserAuthEmail invite', error.message)
        return { ok: false, message: 'Nem sikerült az invite email.' }
      }
    }
  } else {
    const { error: sendError } = await ctx.admin.auth.resetPasswordForEmail(
      user.email,
      { redirectTo: redirectLogin }
    )
    if (sendError) {
      console.error('sendTenantUserAuthEmail send', sendError.message)
      return { ok: false, message: 'Nem sikerült a reset email küldése.' }
    }
  }

  await writePlatformAudit(ctx.admin, {
    tenantId: input.tenantId,
    actorUserId: ctx.user.id,
    action:
      mode === 'invite' ? 'user.invite_email' : 'user.recovery_email',
    details: { userId: input.userId, email: user.email, mode }
  })

  revalidatePath(`${TENANTS_PATH}/${input.tenantId}`)
  return {
    ok: true,
    message:
      mode === 'invite'
        ? 'Invite email elküldve (Supabase Auth).'
        : 'Jelszó-reset email elküldve (Supabase Auth).'
  }
}

export async function revokeUserSessions(input: {
  tenantId: string
  userId: string
}): Promise<PlatformActionResult> {
  const ctx = await requirePlatformAdmin()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const { data: membership } = await ctx.admin
    .from('tenant_memberships')
    .select('id')
    .eq('tenant_id', input.tenantId)
    .eq('user_id', input.userId)
    .maybeSingle()

  if (!membership) {
    return { ok: false, message: 'A felhasználó nem tagja ennek a cégnek.' }
  }

  const { error } = await ctx.admin
    .from('app_user_sessions')
    .delete()
    .eq('user_id', input.userId)

  if (error) {
    console.error('revokeUserSessions', error.message)
    return { ok: false, message: 'Nem sikerült a sessionök törlése.' }
  }

  await writePlatformAudit(ctx.admin, {
    tenantId: input.tenantId,
    actorUserId: ctx.user.id,
    action: 'user.sessions_revoke',
    details: { userId: input.userId }
  })

  revalidatePath(`${TENANTS_PATH}/${input.tenantId}`)
  return { ok: true, message: 'Felhasználó sessionjei érvénytelenítve.' }
}

export async function revokeTenantSessions(input: {
  tenantId: string
}): Promise<PlatformActionResult> {
  const ctx = await requirePlatformAdmin()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const { data: members, error: memError } = await ctx.admin
    .from('tenant_memberships')
    .select('user_id')
    .eq('tenant_id', input.tenantId)

  if (memError) {
    return { ok: false, message: 'Nem sikerült a tagok lekérése.' }
  }

  const userIds = [...new Set((members ?? []).map((m) => m.user_id))]
  if (userIds.length === 0) {
    return { ok: true, message: 'Nincs session törölni.' }
  }

  const { error } = await ctx.admin
    .from('app_user_sessions')
    .delete()
    .in('user_id', userIds)

  if (error) {
    console.error('revokeTenantSessions', error.message)
    return { ok: false, message: 'Nem sikerült a cég sessionjeinek törlése.' }
  }

  await writePlatformAudit(ctx.admin, {
    tenantId: input.tenantId,
    actorUserId: ctx.user.id,
    action: 'tenant.sessions_revoke',
    details: { userCount: userIds.length }
  })

  revalidatePath(`${TENANTS_PATH}/${input.tenantId}`)
  return {
    ok: true,
    message: `Cég sessionjei érvénytelenítve (${userIds.length} user).`
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

  await writePlatformAudit(ctx.admin, {
    tenantId: input.tenantId,
    actorUserId: ctx.user.id,
    action: 'tenant.max_seats',
    details: { maxSeats: input.maxSeats }
  })

  revalidatePath(`${TENANTS_PATH}/${input.tenantId}`)
  revalidatePath(TENANTS_PATH)
  return { ok: true }
}

export async function updateTenantOpsFields(input: {
  tenantId: string
  billingStatus: string
  trialEndsAt: string | null
  paidThrough: string | null
  billingNotes: string
  internalNotes: string
  contactPhone: string
  contactEmail: string
}): Promise<PlatformActionResult> {
  const ctx = await requirePlatformAdmin()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const allowed = ['none', 'trial', 'active', 'past_due', 'canceled']
  if (!allowed.includes(input.billingStatus)) {
    return { ok: false, message: 'Érvénytelen billing státusz.' }
  }

  const { error } = await ctx.admin
    .from('tenants')
    .update({
      billing_status: input.billingStatus,
      trial_ends_at: input.trialEndsAt,
      paid_through: input.paidThrough,
      billing_notes: input.billingNotes.trim() || null,
      internal_notes: input.internalNotes.trim() || null,
      contact_phone: input.contactPhone.trim() || null,
      contact_email: input.contactEmail.trim() || null,
      updated_at: new Date().toISOString()
    })
    .eq('id', input.tenantId)

  if (error) {
    console.error('updateTenantOpsFields', error.message)
    return { ok: false, message: 'Nem sikerült menteni.' }
  }

  await writePlatformAudit(ctx.admin, {
    tenantId: input.tenantId,
    actorUserId: ctx.user.id,
    action: 'tenant.ops_fields',
    details: {
      billingStatus: input.billingStatus,
      trialEndsAt: input.trialEndsAt,
      paidThrough: input.paidThrough
    }
  })

  revalidatePath(`${TENANTS_PATH}/${input.tenantId}`)
  revalidatePath(TENANTS_PATH)
  revalidatePath(PLATFORM_PATH)
  return { ok: true }
}