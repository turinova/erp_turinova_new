'use server'

import { revalidatePath } from 'next/cache'

import { writePlatformAudit } from '@/lib/platform/audit'
import { requirePlatformAdmin } from '@/lib/platform/auth'
import { partnerTenantIsAccepting } from '@/lib/partner/companies'

export type PartnerOpsResult =
  | { ok: true; message?: string }
  | { ok: false; message: string }

const PARTNERS = '/platform/partnerek'

function partnerPath(userId: string) {
  return `${PARTNERS}/${userId}`
}

export async function setPartnerStatus(input: {
  userId: string
  status: 'active' | 'disabled'
  reason?: string
}): Promise<PartnerOpsResult> {
  const ctx = await requirePlatformAdmin()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  if (input.status === 'disabled' && !input.reason?.trim()) {
    // reason optional per product — allow empty
  }

  const now = new Date().toISOString()
  const patch =
    input.status === 'disabled'
      ? {
          status: 'disabled' as const,
          disabled_at: now,
          disabled_reason: input.reason?.trim() || null,
          disabled_by: ctx.user.id,
          updated_at: now
        }
      : {
          status: 'active' as const,
          disabled_at: null,
          disabled_reason: null,
          disabled_by: null,
          updated_at: now
        }

  const { error } = await ctx.admin
    .from('partner_profiles')
    .update(patch)
    .eq('user_id', input.userId)

  if (error) {
    console.error('setPartnerStatus', error.message)
    return { ok: false, message: 'Nem sikerült frissíteni a partner státuszt.' }
  }

  await writePlatformAudit(ctx.admin, {
    tenantId: null,
    actorUserId: ctx.user.id,
    action:
      input.status === 'disabled' ? 'partner.disable' : 'partner.enable',
    details: {
      partnerUserId: input.userId,
      reason: input.reason?.trim() || null
    }
  })

  revalidatePath(PARTNERS)
  revalidatePath(partnerPath(input.userId))
  revalidatePath('/platform')
  return {
    ok: true,
    message:
      input.status === 'disabled'
        ? 'Partner kikapcsolva (nem tud belépni).'
        : 'Partner újra aktív.'
  }
}

/** Cég leválasztása — partner a saját oldalán választhat újra. */
export async function unlinkPartnerTenant(input: {
  userId: string
}): Promise<PartnerOpsResult> {
  const ctx = await requirePlatformAdmin()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const { data: row } = await ctx.admin
    .from('partner_profiles')
    .select('selected_tenant_id, status')
    .eq('user_id', input.userId)
    .maybeSingle()

  if (!row) return { ok: false, message: 'Partner nem található.' }
  if (!row.selected_tenant_id) {
    return { ok: true, message: 'Már nincs kapcsolt cég.' }
  }

  const prev = row.selected_tenant_id
  const { error } = await ctx.admin
    .from('partner_profiles')
    .update({
      selected_tenant_id: null,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', input.userId)

  if (error) {
    console.error('unlinkPartnerTenant', error.message)
    return { ok: false, message: 'Nem sikerült a leválasztás.' }
  }

  await writePlatformAudit(ctx.admin, {
    tenantId: prev,
    actorUserId: ctx.user.id,
    action: 'partner.unlink',
    details: { partnerUserId: input.userId, previousTenantId: prev }
  })

  revalidatePath(PARTNERS)
  revalidatePath(partnerPath(input.userId))
  revalidatePath('/platform')
  return {
    ok: true,
    message: 'Cég leválasztva. A partner újra választhat a beállításokban.'
  }
}

/** Opcionális support override — partner is válthat utána. */
export async function setPartnerTenant(input: {
  userId: string
  tenantId: string
}): Promise<PartnerOpsResult> {
  const ctx = await requirePlatformAdmin()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const accepts = await partnerTenantIsAccepting(input.tenantId)
  if (!accepts) {
    return {
      ok: false,
      message: 'A cég nem fogad partner rendelést (státusz vagy add-on).'
    }
  }

  const { data: row } = await ctx.admin
    .from('partner_profiles')
    .select('status')
    .eq('user_id', input.userId)
    .maybeSingle()

  if (!row) return { ok: false, message: 'Partner nem található.' }
  if (row.status === 'disabled') {
    return { ok: false, message: 'Előbb kapcsold vissza a partnert.' }
  }

  const { error } = await ctx.admin
    .from('partner_profiles')
    .update({
      selected_tenant_id: input.tenantId,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', input.userId)

  if (error) {
    console.error('setPartnerTenant', error.message)
    return { ok: false, message: 'Nem sikerült a cég beállítása.' }
  }

  await writePlatformAudit(ctx.admin, {
    tenantId: input.tenantId,
    actorUserId: ctx.user.id,
    action: 'partner.set_tenant',
    details: { partnerUserId: input.userId, tenantId: input.tenantId }
  })

  revalidatePath(PARTNERS)
  revalidatePath(partnerPath(input.userId))
  return { ok: true, message: 'Kapcsolt cég beállítva.' }
}
