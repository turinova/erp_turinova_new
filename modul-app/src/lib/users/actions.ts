'use server'

import { revalidatePath } from 'next/cache'

import { revokeAppSessionForUser } from '@/lib/auth/app-session'
import { getSessionUser, clearSessionSnapshotCookie } from '@/lib/auth/session'
import {
  ALL_PAGE_KEYS,
  ALWAYS_ALLOWED_PAGE_KEYS,
  mergeAlwaysAllowed,
  PAGE_ACCESS_TEMPLATES,
  type PageAccessTemplateId
} from '@/lib/permissions/pages'
import { listPageAccessMap } from '@/lib/permissions/access'
import {
  findAuthUserByEmail,
  getAuthUsersByIds,
  invalidateAuthUsersCache
} from '@/lib/platform/auth-users'
import { listTenantEntitledPageKeys } from '@/lib/platform/entitlements'
import type {
  MembershipStatus,
  TenantRole
} from '@/lib/supabase/database.types'
import { createClient } from '@/lib/supabase/server'
import {
  createServiceClient,
  isServiceRoleConfigured
} from '@/lib/supabase/service'
import { TENANT_ROLE_LABELS } from '@/lib/tenancy/memberships'
import { getTenantSeatInfo } from '@/lib/tenancy/seats'

const USERS_PATH = '/beallitasok/felhasznalok'
const PROFILE_PATH = '/beallitasok/profil'

export type TenantUserListItem = {
  membershipId: string
  userId: string
  email: string
  displayName: string | null
  role: TenantRole
  roleLabel: string
  status: MembershipStatus
  createdAt: string
}

export type ActionResult =
  | { ok: true }
  | { ok: false; message: string }

async function requireUserManager() {
  const user = await getSessionUser()
  if (!user?.tenantId || !user.hasMembership) {
    return { ok: false as const, message: 'Nincs aktív céged.' }
  }
  if (!user.canManageUsers) {
    return {
      ok: false as const,
      message: 'Csak tulajdonos vagy adminisztrátor kezelhet felhasználókat.'
    }
  }
  if (user.isDevSession) {
    return {
      ok: false as const,
      message:
        'Dev bypass módban nincs adatbázis. Kapcsold be a Supabase env-et.'
    }
  }
  const supabase = await createClient()
  if (!supabase) {
    return { ok: false as const, message: 'Az adatbázis kapcsolat nem elérhető.' }
  }
  return { ok: true as const, user, supabase }
}

async function endImpersonationsForUser(
  admin: NonNullable<ReturnType<typeof createServiceClient>>,
  userId: string
) {
  await admin
    .from('platform_impersonation_sessions')
    .update({ ended_at: new Date().toISOString() })
    .eq('target_user_id', userId)
    .is('ended_at', null)
}

async function upsertDisplayName(
  admin: NonNullable<ReturnType<typeof createServiceClient>>,
  userId: string,
  displayName: string | null | undefined
) {
  const name = displayName?.trim() || null
  if (!name) return
  const { error } = await admin.from('user_profiles').upsert(
    {
      user_id: userId,
      display_name: name,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'user_id' }
  )
  if (error) console.error('upsertDisplayName', error.message)
}

async function insertPageAccessRows(input: {
  admin: NonNullable<ReturnType<typeof createServiceClient>>
  tenantId: string
  membershipId: string
  role: TenantRole
  template: PageAccessTemplateId
  pageKeys?: string[]
}): Promise<ActionResult> {
  const templateKeys =
    input.pageKeys ??
    PAGE_ACCESS_TEMPLATES[input.template]?.keys ??
    PAGE_ACCESS_TEMPLATES.office.keys
  const entitledList = await listTenantEntitledPageKeys(
    input.admin,
    input.tenantId
  )
  const entitled = new Set(
    entitledList.length > 0 ? entitledList : ALL_PAGE_KEYS
  )
  const keys = mergeAlwaysAllowed(templateKeys).filter(
    (k) => entitled.has(k) || ALWAYS_ALLOWED_PAGE_KEYS.includes(k)
  )

  const rows = ALL_PAGE_KEYS.map((page_key) => {
    let can = keys.includes(page_key) && entitled.has(page_key)
    if (page_key === '/beallitasok/elofizetes') can = false
    if (
      page_key === '/beallitasok/elofizetes' &&
      input.role === 'owner'
    ) {
      can = true
    }
    return {
      tenant_id: input.tenantId,
      membership_id: input.membershipId,
      page_key,
      can_access: can
    }
  })

  const { error: accessError } = await input.admin
    .from('tenant_membership_page_access')
    .insert(rows)

  if (accessError) {
    console.error('insertPageAccessRows', accessError.message)
    return {
      ok: false,
      message:
        'Felhasználó létrejött, de az oldaljogok mentése sikertelen. Állítsd be a Jogok dialógusban.'
    }
  }
  return { ok: true }
}

export async function listTenantUsers(): Promise<{
  rows: TenantUserListItem[]
  error: string | null
}> {
  const ctx = await requireUserManager()
  if (!ctx.ok) return { rows: [], error: ctx.message }

  const { data: memberships, error } = await ctx.supabase
    .from('tenant_memberships')
    .select('id, user_id, role, status, created_at')
    .eq('tenant_id', ctx.user.tenantId!)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('listTenantUsers', error.message)
    return { rows: [], error: 'Nem sikerült betölteni a felhasználókat.' }
  }

  const admin = createServiceClient()
  const emailById = new Map<string, string>()
  const nameById = new Map<string, string | null>()
  const ids = (memberships ?? []).map((m) => m.user_id)

  if (admin && ids.length > 0) {
    const authMap = await getAuthUsersByIds(admin, ids)
    for (const [id, lite] of authMap) {
      if (lite.email) emailById.set(id, lite.email)
    }

    const { data: profiles } = await admin
      .from('user_profiles')
      .select('user_id, display_name')
      .in('user_id', ids)
    for (const p of profiles ?? []) {
      nameById.set(p.user_id, p.display_name)
    }
  } else if (ids.length > 0) {
    const { data: profiles } = await ctx.supabase
      .from('user_profiles')
      .select('user_id, display_name')
      .in('user_id', ids)
    for (const p of profiles ?? []) {
      nameById.set(p.user_id, p.display_name)
    }
  }

  const rows: TenantUserListItem[] = (memberships ?? []).map((m) => ({
    membershipId: m.id,
    userId: m.user_id,
    email: emailById.get(m.user_id) ?? '(email nem elérhető)',
    displayName: nameById.get(m.user_id) ?? null,
    role: m.role as TenantRole,
    roleLabel: TENANT_ROLE_LABELS[m.role as TenantRole] ?? m.role,
    status: (m.status as MembershipStatus) ?? 'active',
    createdAt: m.created_at
  }))

  return { rows, error: null }
}

export async function getMembershipPageAccess(
  membershipId: string
): Promise<{
  map: Record<string, boolean>
  entitledPages: string[]
  error: string | null
}> {
  const ctx = await requireUserManager()
  if (!ctx.ok) return { map: {}, entitledPages: [], error: ctx.message }

  const { data: membership, error } = await ctx.supabase
    .from('tenant_memberships')
    .select('id')
    .eq('id', membershipId)
    .eq('tenant_id', ctx.user.tenantId!)
    .maybeSingle()

  if (error || !membership) {
    return {
      map: {},
      entitledPages: [],
      error: 'A felhasználó nem található ebben a cégben.'
    }
  }

  const entitledPages =
    ctx.user.entitledPages.length > 0
      ? ctx.user.entitledPages
      : await listTenantEntitledPageKeys(ctx.supabase, ctx.user.tenantId!)

  const map = await listPageAccessMap(ctx.supabase, membershipId)
  return { map, entitledPages, error: null }
}

export async function createTenantUser(input: {
  email: string
  password: string
  role: Exclude<TenantRole, 'owner'>
  template: PageAccessTemplateId
  displayName?: string
  pageKeys?: string[]
}): Promise<ActionResult & { membershipId?: string }> {
  const ctx = await requireUserManager()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  if (!isServiceRoleConfigured()) {
    return {
      ok: false,
      message:
        'Most nem lehet felhasználót felvenni. Írj a supportnak.'
    }
  }

  const email = input.email.trim().toLowerCase()
  const password = input.password
  if (!email || !email.includes('@')) {
    return { ok: false, message: 'Érvényes email címet adj meg.' }
  }
  if (!['admin', 'member', 'viewer'].includes(input.role)) {
    return { ok: false, message: 'Érvénytelen szerepkör.' }
  }

  const admin = createServiceClient()
  if (!admin) {
    return { ok: false, message: 'Service role kliens nem elérhető.' }
  }

  const seats = await getTenantSeatInfo(admin, ctx.user.tenantId!)
  if (seats.atLimit) {
    return {
      ok: false,
      message: `Nincs több hely (${seats.usedSeats}/${seats.maxSeats}). Bővítéshez írj a supportnak.`
    }
  }

  const existingAuth = await findAuthUserByEmail(admin, email)
  let userId: string

  if (existingAuth) {
    const { data: partnerRow } = await admin
      .from('partner_profiles')
      .select('user_id')
      .eq('user_id', existingAuth.id)
      .maybeSingle()
    if (partnerRow) {
      return {
        ok: false,
        message:
          'Ez az email asztalos (partner) fiókhoz tartozik — céges felhasználóként nem vehető fel.'
      }
    }

    const { data: existingMem } = await admin
      .from('tenant_memberships')
      .select('id, status')
      .eq('tenant_id', ctx.user.tenantId!)
      .eq('user_id', existingAuth.id)
      .maybeSingle()

    if (existingMem) {
      if (existingMem.status === 'disabled') {
        return {
          ok: false,
          message:
            'Ez a felhasználó már tag, de le van tiltva. Aktiváld újra a listából.'
        }
      }
      return { ok: false, message: 'Ez az email már tagja a cégnek.' }
    }

    if (password.length > 0 && password.length < 8) {
      return {
        ok: false,
        message: 'A jelszó legalább 8 karakter legyen (vagy hagyd üresen meglévő fióknál).'
      }
    }

    if (password.length >= 8) {
      const { error: pwError } = await admin.auth.admin.updateUserById(
        existingAuth.id,
        { password }
      )
      if (pwError) {
        console.error('createTenantUser update password', pwError.message)
      }
    }

    userId = existingAuth.id
  } else {
    if (password.length < 8) {
      return { ok: false, message: 'A jelszó legalább 8 karakter legyen.' }
    }

    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      })

    if (createError || !created.user) {
      const msg = createError?.message ?? ''
      if (msg.toLowerCase().includes('already') || msg.includes('registered')) {
        return {
          ok: false,
          message:
            'Ez az email már regisztrálva van. Próbáld újra — a rendszer hozzáadja tagságként.'
        }
      }
      console.error('createTenantUser', createError?.message)
      return { ok: false, message: 'Nem sikerült létrehozni a felhasználót.' }
    }
    userId = created.user.id
    invalidateAuthUsersCache()
  }

  const tenantId = ctx.user.tenantId!
  const createdNewAuth = !existingAuth

  const { data: membership, error: memError } = await admin
    .from('tenant_memberships')
    .insert({
      tenant_id: tenantId,
      user_id: userId,
      role: input.role,
      status: 'active'
    })
    .select('id')
    .single()

  if (memError || !membership) {
    console.error('createTenantUser membership', memError?.message)
    if (createdNewAuth) {
      await admin.auth.admin.deleteUser(userId)
    }
    return {
      ok: false,
      message: createdNewAuth
        ? 'A tagság létrehozása sikertelen — a fiók visszavonva.'
        : 'A tagság létrehozása sikertelen.'
    }
  }

  await upsertDisplayName(admin, userId, input.displayName)

  const accessResult = await insertPageAccessRows({
    admin,
    tenantId,
    membershipId: membership.id,
    role: input.role,
    template: input.template,
    pageKeys: input.pageKeys
  })

  revalidatePath(USERS_PATH)
  if (!accessResult.ok) {
    return { ...accessResult, membershipId: membership.id }
  }
  return { ok: true, membershipId: membership.id }
}

export async function updateMembershipPageAccess(input: {
  membershipId: string
  access: Record<string, boolean>
}): Promise<ActionResult> {
  const ctx = await requireUserManager()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const tenantId = ctx.user.tenantId!
  const { data: membership, error } = await ctx.supabase
    .from('tenant_memberships')
    .select('id, user_id, role')
    .eq('id', input.membershipId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error || !membership) {
    return { ok: false, message: 'A felhasználó nem található.' }
  }

  const entitledList = await listTenantEntitledPageKeys(ctx.supabase, tenantId)
  const entitled = new Set(
    entitledList.length > 0 ? entitledList : ALL_PAGE_KEYS
  )

  const rows = ALL_PAGE_KEYS.map((page_key) => {
    const forced = ALWAYS_ALLOWED_PAGE_KEYS.includes(page_key)
    let can =
      forced || (entitled.has(page_key) && Boolean(input.access[page_key]))
    if (
      page_key === '/beallitasok/elofizetes' &&
      membership.role !== 'owner'
    ) {
      can = false
    }
    if (
      page_key === '/beallitasok/elofizetes' &&
      membership.role === 'owner'
    ) {
      can = true
    }
    return {
      tenant_id: tenantId,
      membership_id: input.membershipId,
      page_key,
      can_access: can,
      updated_at: new Date().toISOString()
    }
  })

  const { error: upsertError } = await ctx.supabase
    .from('tenant_membership_page_access')
    .upsert(rows, { onConflict: 'membership_id,page_key' })

  if (upsertError) {
    console.error('updateMembershipPageAccess', upsertError.message)
    return { ok: false, message: 'Nem sikerült menteni az oldaljogokat.' }
  }

  await clearSessionSnapshotCookie()
  if (membership.user_id !== ctx.user.id) {
    await revokeAppSessionForUser(membership.user_id)
  }

  revalidatePath(USERS_PATH)
  return { ok: true }
}

export async function updateMembershipRole(input: {
  membershipId: string
  role: Exclude<TenantRole, 'owner'>
}): Promise<ActionResult> {
  const ctx = await requireUserManager()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  if (!['admin', 'member', 'viewer'].includes(input.role)) {
    return { ok: false, message: 'Érvénytelen szerepkör.' }
  }

  const { data: membership, error } = await ctx.supabase
    .from('tenant_memberships')
    .select('id, user_id, role')
    .eq('id', input.membershipId)
    .eq('tenant_id', ctx.user.tenantId!)
    .maybeSingle()

  if (error || !membership) {
    return { ok: false, message: 'A felhasználó nem található.' }
  }

  if (membership.role === 'owner') {
    return { ok: false, message: 'A tulajdonos szerepe nem módosítható itt.' }
  }

  if (membership.user_id === ctx.user.id) {
    return { ok: false, message: 'A saját szerepedet nem módosíthatod.' }
  }

  const admin = createServiceClient()
  const client = admin ?? ctx.supabase

  const { error: updateError } = await client
    .from('tenant_memberships')
    .update({ role: input.role })
    .eq('id', input.membershipId)
    .eq('tenant_id', ctx.user.tenantId!)

  if (updateError) {
    console.error('updateMembershipRole', updateError.message)
    return { ok: false, message: 'Nem sikerült frissíteni a szerepet.' }
  }

  await revokeAppSessionForUser(membership.user_id)

  revalidatePath(USERS_PATH)
  return { ok: true }
}

export async function removeTenantMember(input: {
  membershipId: string
}): Promise<ActionResult> {
  const ctx = await requireUserManager()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  if (!isServiceRoleConfigured()) {
    return {
      ok: false,
      message: 'Most nem lehet eltávolítani. Írj a supportnak.'
    }
  }

  const admin = createServiceClient()
  if (!admin) {
    return { ok: false, message: 'Service role kliens nem elérhető.' }
  }

  const tenantId = ctx.user.tenantId!
  const { data: membership, error } = await admin
    .from('tenant_memberships')
    .select('id, user_id, role')
    .eq('id', input.membershipId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error || !membership) {
    return { ok: false, message: 'A felhasználó nem található.' }
  }

  if (membership.user_id === ctx.user.id) {
    return { ok: false, message: 'Saját magadat nem távolíthatod el.' }
  }

  if (membership.role === 'owner') {
    const { count } = await admin
      .from('tenant_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('role', 'owner')
      .eq('status', 'active')
    if ((count ?? 0) <= 1) {
      return {
        ok: false,
        message: 'Az utolsó tulajdonos nem távolítható el.'
      }
    }
  }

  const { error: deleteError } = await admin
    .from('tenant_memberships')
    .delete()
    .eq('id', membership.id)
    .eq('tenant_id', tenantId)

  if (deleteError) {
    console.error('removeTenantMember', deleteError.message)
    return { ok: false, message: 'Nem sikerült eltávolítani a felhasználót.' }
  }

  await endImpersonationsForUser(admin, membership.user_id)
  await revokeAppSessionForUser(membership.user_id)

  revalidatePath(USERS_PATH)
  return { ok: true }
}

export async function setMembershipDisabled(input: {
  membershipId: string
  disabled: boolean
}): Promise<ActionResult> {
  const ctx = await requireUserManager()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  if (!isServiceRoleConfigured()) {
    return {
      ok: false,
      message: 'Most nem lehet a belépést módosítani. Írj a supportnak.'
    }
  }

  const admin = createServiceClient()
  if (!admin) {
    return { ok: false, message: 'Service role kliens nem elérhető.' }
  }

  const tenantId = ctx.user.tenantId!
  const { data: membership, error } = await admin
    .from('tenant_memberships')
    .select('id, user_id, role, status')
    .eq('id', input.membershipId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error || !membership) {
    return { ok: false, message: 'A felhasználó nem található.' }
  }

  if (membership.user_id === ctx.user.id) {
    return { ok: false, message: 'Saját magadat nem tilthatod le.' }
  }

  if (input.disabled && membership.role === 'owner') {
    const { count } = await admin
      .from('tenant_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('role', 'owner')
      .eq('status', 'active')
    if ((count ?? 0) <= 1) {
      return {
        ok: false,
        message: 'Az utolsó tulajdonos nem tiltható le.'
      }
    }
  }

  if (!input.disabled) {
    const seats = await getTenantSeatInfo(admin, tenantId)
    if (seats.atLimit && membership.status === 'disabled') {
      return {
        ok: false,
        message: `Nincs több hely (${seats.usedSeats}/${seats.maxSeats}). Aktiválás előtt bővítsd a helyeket, vagy írj a supportnak.`
      }
    }
  }

  const { error: updateError } = await admin
    .from('tenant_memberships')
    .update({
      status: input.disabled ? 'disabled' : 'active',
      disabled_at: input.disabled ? new Date().toISOString() : null
    })
    .eq('id', membership.id)
    .eq('tenant_id', tenantId)

  if (updateError) {
    console.error('setMembershipDisabled', updateError.message)
    return { ok: false, message: 'Nem sikerült frissíteni a státuszt.' }
  }

  if (input.disabled) {
    await endImpersonationsForUser(admin, membership.user_id)
  }
  await revokeAppSessionForUser(membership.user_id)

  revalidatePath(USERS_PATH)
  return { ok: true }
}

export async function getOwnProfile(): Promise<{
  displayName: string
  email: string
  error: string | null
}> {
  const user = await getSessionUser()
  if (!user) {
    return { displayName: '', email: '', error: 'Nincs bejelentkezés.' }
  }
  if (user.isDevSession) {
    return {
      displayName: '',
      email: user.email,
      error: 'Dev bypass módban nincs profil.'
    }
  }

  const supabase = await createClient()
  if (!supabase) {
    return {
      displayName: '',
      email: user.email,
      error: 'Az adatbázis kapcsolat nem elérhető.'
    }
  }

  const { data } = await supabase
    .from('user_profiles')
    .select('display_name')
    .eq('user_id', user.id)
    .maybeSingle()

  return {
    displayName: data?.display_name ?? user.displayName ?? '',
    email: user.email,
    error: null
  }
}

export async function updateOwnDisplayName(input: {
  displayName: string
}): Promise<ActionResult> {
  const user = await getSessionUser()
  if (!user) return { ok: false, message: 'Nincs bejelentkezés.' }
  if (user.isDevSession) {
    return { ok: false, message: 'Dev bypass módban nincs profil mentés.' }
  }

  const name = input.displayName.trim()
  if (name.length < 1) {
    return { ok: false, message: 'Add meg a megjelenített nevet.' }
  }
  if (name.length > 120) {
    return { ok: false, message: 'A név legfeljebb 120 karakter lehet.' }
  }

  const supabase = await createClient()
  if (!supabase) {
    return { ok: false, message: 'Az adatbázis kapcsolat nem elérhető.' }
  }

  const { error } = await supabase.from('user_profiles').upsert(
    {
      user_id: user.id,
      display_name: name,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'user_id' }
  )

  if (error) {
    console.error('updateOwnDisplayName', error.message)
    return { ok: false, message: 'Nem sikerült menteni a nevet.' }
  }

  await clearSessionSnapshotCookie()
  revalidatePath(PROFILE_PATH)
  revalidatePath(USERS_PATH)
  return { ok: true }
}

/** Admin/owner: másik (vagy saját) tag megjelenített neve. */
export async function updateMemberDisplayName(input: {
  membershipId: string
  displayName: string
}): Promise<ActionResult> {
  const ctx = await requireUserManager()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  if (!isServiceRoleConfigured()) {
    return {
      ok: false,
      message: 'Most nem lehet nevet menteni. Írj a supportnak.'
    }
  }

  const name = input.displayName.trim()
  if (name.length < 1) {
    return { ok: false, message: 'Add meg a megjelenített nevet.' }
  }
  if (name.length > 120) {
    return { ok: false, message: 'A név legfeljebb 120 karakter lehet.' }
  }

  const admin = createServiceClient()
  if (!admin) {
    return { ok: false, message: 'Most nem lehet nevet menteni. Írj a supportnak.' }
  }

  const { data: membership, error } = await admin
    .from('tenant_memberships')
    .select('id, user_id')
    .eq('id', input.membershipId)
    .eq('tenant_id', ctx.user.tenantId!)
    .maybeSingle()

  if (error || !membership) {
    return { ok: false, message: 'A felhasználó nem található.' }
  }

  await upsertDisplayName(admin, membership.user_id, name)

  if (membership.user_id === ctx.user.id) {
    await clearSessionSnapshotCookie()
  }

  revalidatePath(USERS_PATH)
  revalidatePath(PROFILE_PATH)
  return { ok: true }
}
