'use server'

import { getSessionUser } from '@/lib/auth/session'
import { HANDOFF_TTL_HOURS, type PosHandoffListItem } from '@/lib/pos/handoff-types'
import { tenantHasPdaPos } from '@/lib/pos/pda-entitlement'
import {
  normalizeCartLine,
  type PosCartLine
} from '@/lib/pos/session'
import { createClient } from '@/lib/supabase/server'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'

function lineTotalGross(lines: PosCartLine[]): number {
  return lines.reduce((sum, l) => {
    const before = Math.round(l.quantity * l.unitPriceGross)
    const disc = Math.round((before * (l.discountPercentage || 0)) / 100)
    return sum + Math.max(0, before - disc)
  }, 0)
}

function mapListRow(row: {
  id: string
  code: string
  status: string
  warehouse_id: string
  customer_id: string | null
  created_by_name: string | null
  lines: unknown
  created_at: string
  expires_at: string
}): PosHandoffListItem {
  const lines = Array.isArray(row.lines)
    ? row.lines
        .map(normalizeCartLine)
        .filter((l): l is PosCartLine => l != null && l.quantity > 0)
    : []
  return {
    id: row.id,
    code: row.code,
    status: row.status as PosHandoffListItem['status'],
    warehouseId: row.warehouse_id,
    customerId: row.customer_id,
    createdByName: row.created_by_name,
    lineCount: lines.length,
    totalGross: lineTotalGross(lines),
    createdAt: row.created_at,
    expiresAt: row.expires_at
  }
}

async function assertPdaAddon(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  tenantId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const has = await tenantHasPdaPos(supabase, tenantId)
  if (!has) {
    return { ok: false, message: 'Nincs PDA POS add-on.' }
  }
  return { ok: true }
}

export async function createPosCartHandoffAction(input: {
  warehouseId: string
  customerId?: string | null
  lines: PosCartLine[]
  note?: string | null
}): Promise<
  | { ok: true; id: string; code: string }
  | { ok: false; message: string }
> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const gate = await assertPdaAddon(ctx.supabase, ctx.user.tenantId!)
  if (!gate.ok) return gate

  const lines = (input.lines ?? [])
    .map((l) => normalizeCartLine(l))
    .filter((l): l is PosCartLine => l != null && l.quantity > 0)

  if (lines.length === 0) {
    return { ok: false, message: 'Üres a kosár — előbb tegyél be terméket.' }
  }
  if (!input.warehouseId) {
    return { ok: false, message: 'Válaszd ki a raktárat.' }
  }

  // Only product lines for PDA handoff P0
  if (lines.some((l) => l.kind !== 'product' || !l.accessoryId)) {
    return {
      ok: false,
      message: 'Átadáshoz csak termék (db) tételek engedélyezettek.'
    }
  }

  const { data: codeRaw, error: codeErr } = await ctx.supabase.rpc(
    'next_pos_handoff_code',
    { p_tenant_id: ctx.user.tenantId }
  )
  if (codeErr || !codeRaw) {
    console.error('createPosCartHandoffAction code', codeErr?.message)
    return { ok: false, message: 'Nem sikerült kódot generálni.' }
  }

  const expiresAt = new Date(
    Date.now() + HANDOFF_TTL_HOURS * 60 * 60 * 1000
  ).toISOString()

  const createdByName =
    ctx.user.displayName?.trim() || ctx.user.email?.split('@')[0] || null

  const { data, error } = await ctx.supabase
    .from('pos_cart_handoffs')
    .insert({
      tenant_id: ctx.user.tenantId,
      code: String(codeRaw),
      status: 'open',
      warehouse_id: input.warehouseId,
      customer_id: input.customerId || null,
      created_by: ctx.user.id,
      created_by_name: createdByName,
      lines,
      note: input.note?.trim() || null,
      expires_at: expiresAt
    })
    .select('id, code')
    .single()

  if (error || !data) {
    console.error('createPosCartHandoffAction', error?.message)
    return {
      ok: false,
      message: error?.message?.includes('pos_cart_handoffs')
        ? 'Átadás tábla hiányzik — futtasd a 20260583 migrációt.'
        : 'Nem sikerült átadni a kosarat.'
    }
  }

  return { ok: true, id: data.id as string, code: data.code as string }
}

export async function listOpenPosCartHandoffsAction(): Promise<
  | { ok: true; rows: PosHandoffListItem[] }
  | { ok: false; message: string }
> {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return { ok: false, message: 'Nincs munkamenet.' }
  }
  const supabase = await createClient()
  if (!supabase) return { ok: false, message: 'Nincs adatbázis kapcsolat.' }

  const gate = await assertPdaAddon(supabase, user.tenantId)
  if (!gate.ok) return gate

  await supabase.rpc('expire_pos_cart_handoffs', {
    p_tenant_id: user.tenantId
  })

  const { data, error } = await supabase
    .from('pos_cart_handoffs')
    .select(
      `
      id,
      code,
      status,
      warehouse_id,
      customer_id,
      created_by_name,
      lines,
      created_at,
      expires_at
    `
    )
    .eq('tenant_id', user.tenantId)
    .eq('status', 'open')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(25)

  if (error) {
    console.error('listOpenPosCartHandoffsAction', error.message)
    return { ok: false, message: 'Nem sikerült betölteni a PDA kosarakat.' }
  }

  return {
    ok: true,
    rows: (data ?? []).map((r) => mapListRow(r as Parameters<typeof mapListRow>[0]))
  }
}

export async function claimPosCartHandoffAction(input: {
  handoffId: string
}): Promise<
  | {
      ok: true
      code: string
      warehouseId: string
      customerId: string | null
      lines: PosCartLine[]
    }
  | { ok: false; message: string }
> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const gate = await assertPdaAddon(ctx.supabase, ctx.user.tenantId!)
  if (!gate.ok) return gate

  if (!input.handoffId) {
    return { ok: false, message: 'Hiányzó kosár azonosító.' }
  }

  const { data, error } = await ctx.supabase.rpc('claim_pos_cart_handoff', {
    p_tenant_id: ctx.user.tenantId,
    p_handoff_id: input.handoffId,
    p_claimed_by: ctx.user.id
  })

  if (error || !data) {
    console.error('claimPosCartHandoffAction', error?.message)
    const msg = error?.message ?? ''
    if (/már átvéve|lejárt|nem található/i.test(msg)) {
      return { ok: false, message: msg }
    }
    return { ok: false, message: 'Nem sikerült átvenni a kosarat.' }
  }

  const row = (
    Array.isArray(data) ? data[0] : data
  ) as {
    code: string
    warehouse_id: string
    customer_id: string | null
    lines: unknown
  } | undefined

  if (!row) {
    return { ok: false, message: 'Nem sikerült átvenni a kosarat.' }
  }

  const lines = Array.isArray(row.lines)
    ? row.lines
        .map(normalizeCartLine)
        .filter((l): l is PosCartLine => l != null && l.quantity > 0)
    : []

  if (lines.length === 0) {
    return { ok: false, message: 'Az átadott kosár üres.' }
  }

  return {
    ok: true,
    code: row.code,
    warehouseId: row.warehouse_id,
    customerId: row.customer_id,
    lines
  }
}

export async function cancelPosCartHandoffAction(input: {
  handoffId: string
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const gate = await assertPdaAddon(ctx.supabase, ctx.user.tenantId!)
  if (!gate.ok) return gate

  const { data, error } = await ctx.supabase
    .from('pos_cart_handoffs')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', input.handoffId)
    .eq('tenant_id', ctx.user.tenantId)
    .eq('status', 'open')
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('cancelPosCartHandoffAction', error.message)
    return { ok: false, message: 'Nem sikerült visszavonni.' }
  }
  if (!data) {
    return { ok: false, message: 'A kosár már nem visszavonható.' }
  }
  return { ok: true }
}

export async function countOpenPosCartHandoffsAction(): Promise<
  | { ok: true; count: number }
  | { ok: false; message: string }
> {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return { ok: false, message: 'Nincs munkamenet.' }
  }
  const supabase = await createClient()
  if (!supabase) return { ok: false, message: 'Nincs adatbázis kapcsolat.' }

  const gate = await assertPdaAddon(supabase, user.tenantId)
  if (!gate.ok) return { ok: true, count: 0 }

  const { count, error } = await supabase
    .from('pos_cart_handoffs')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', user.tenantId)
    .eq('status', 'open')
    .gt('expires_at', new Date().toISOString())

  if (error) {
    console.error('countOpenPosCartHandoffsAction', error.message)
    return { ok: true, count: 0 }
  }
  return { ok: true, count: count ?? 0 }
}
