'use server'

import { revalidatePath } from 'next/cache'

import { getSessionUser, clearSessionSnapshotCookie } from '@/lib/auth/session'
import {
  ALL_PAGE_KEYS,
  ALWAYS_ALLOWED_PAGE_KEYS,
  mergeAlwaysAllowed,
  PAGE_ACCESS_TEMPLATES,
  type PageAccessTemplateId
} from '@/lib/permissions/pages'
import { listPageAccessMap } from '@/lib/permissions/access'
import { listTenantEntitledPageKeys } from '@/lib/platform/entitlements'
import type { TenantRole } from '@/lib/supabase/database.types'
import { createClient } from '@/lib/supabase/server'
import {
  createServiceClient,
  isServiceRoleConfigured
} from '@/lib/supabase/service'
import { TENANT_ROLE_LABELS } from '@/lib/tenancy/memberships'
import { getTenantSeatInfo } from '@/lib/tenancy/seats'

const USERS_PATH = '/beallitasok/felhasznalok'

export type TenantUserListItem = {
  membershipId: string
  userId: string
  email: string
  role: TenantRole
  roleLabel: string
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

export async function listTenantUsers(): Promise<{
  rows: TenantUserListItem[]
  error: string | null
}> {
  const ctx = await requireUserManager()
  if (!ctx.ok) return { rows: [], error: ctx.message }

  const { data: memberships, error } = await ctx.supabase
    .from('tenant_memberships')
    .select('id, user_id, role, created_at')
    .eq('tenant_id', ctx.user.tenantId!)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('listTenantUsers', error.message)
    return { rows: [], error: 'Nem sikerült betölteni a felhasználókat.' }
  }

  const admin = createServiceClient()
  const emailById = new Map<string, string>()

  if (admin && memberships && memberships.length > 0) {
    const ids = memberships.map((m) => m.user_id)
    // listUsers is paginated; for small tenants fetch and filter
    const { data: listed, error: listError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    })
    if (listError) {
      console.error('listTenantUsers emails', listError.message)
    } else {
      for (const u of listed.users) {
        if (ids.includes(u.id) && u.email) {
          emailById.set(u.id, u.email)
        }
      }
    }
  }

  const rows: TenantUserListItem[] = (memberships ?? []).map((m) => ({
    membershipId: m.id,
    userId: m.user_id,
    email: emailById.get(m.user_id) ?? '(email nem elérhető)',
    role: m.role as TenantRole,
    roleLabel: TENANT_ROLE_LABELS[m.role as TenantRole] ?? m.role,
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
  pageKeys?: string[]
}): Promise<ActionResult & { membershipId?: string }> {
  const ctx = await requireUserManager()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  if (!isServiceRoleConfigured()) {
    return {
      ok: false,
      message:
        'Hiányzik a SUPABASE_SERVICE_ROLE_KEY — felhasználó létrehozáshoz kell.'
    }
  }

  const email = input.email.trim().toLowerCase()
  const password = input.password
  if (!email || !email.includes('@')) {
    return { ok: false, message: 'Érvényes email címet adj meg.' }
  }
  if (password.length < 8) {
    return { ok: false, message: 'A jelszó legalább 8 karakter legyen.' }
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
      message: `Elérted a felhasználói limitet (${seats.usedSeats}/${seats.maxSeats}). Bővítéshez keresd a platform operátort.`
    }
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
        message: 'Ez az email már regisztrálva van. Add hozzá tagságként SQL-lel, vagy másik emailt használj.'
      }
    }
    console.error('createTenantUser', createError?.message)
    return { ok: false, message: 'Nem sikerült létrehozni a felhasználót.' }
  }

  const userId = created.user.id
  const tenantId = ctx.user.tenantId!

  const { data: membership, error: memError } = await admin
    .from('tenant_memberships')
    .insert({
      tenant_id: tenantId,
      user_id: userId,
      role: input.role
    })
    .select('id')
    .single()

  if (memError || !membership) {
    console.error('createTenantUser membership', memError?.message)
    await admin.auth.admin.deleteUser(userId)
    return {
      ok: false,
      message: 'A tagság létrehozása sikertelen — a fiók visszavonva.'
    }
  }

  const templateKeys =
    input.pageKeys ??
    PAGE_ACCESS_TEMPLATES[input.template]?.keys ??
    PAGE_ACCESS_TEMPLATES.office.keys
  const entitled =
    ctx.user.entitledPages.length > 0
      ? new Set(ctx.user.entitledPages)
      : new Set(ALL_PAGE_KEYS)
  const keys = mergeAlwaysAllowed(templateKeys).filter(
    (k) => entitled.has(k) || ALWAYS_ALLOWED_PAGE_KEYS.includes(k)
  )

  const rows = ALL_PAGE_KEYS.map((page_key) => {
    let can = keys.includes(page_key) && entitled.has(page_key)
    // Előfizetés soha nem megy nem-owner tagoknak (full template sem)
    if (page_key === '/beallitasok/elofizetes') can = false
    return {
      tenant_id: tenantId,
      membership_id: membership.id,
      page_key,
      can_access: can
    }
  })

  const { error: accessError } = await admin
    .from('tenant_membership_page_access')
    .insert(rows)

  if (accessError) {
    console.error('createTenantUser access', accessError.message)
    return {
      ok: false,
      message:
        'Felhasználó létrejött, de az oldaljogok mentése sikertelen. Állítsd be a Jogok dialógusban.'
    }
  }

  revalidatePath(USERS_PATH)
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

  const entitled = new Set(
    ctx.user.entitledPages.length > 0 ? ctx.user.entitledPages : ALL_PAGE_KEYS
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

  // Saját jogváltozás / admin session: snapshot invalid (TTL is véd)
  if (membership.user_id === ctx.user.id) {
    await clearSessionSnapshotCookie()
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

  // Prefer service role for update if RLS blocks non-owner writes on memberships
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

  if (membership.user_id === ctx.user.id) {
    await clearSessionSnapshotCookie()
  }

  revalidatePath(USERS_PATH)
  return { ok: true }
}
