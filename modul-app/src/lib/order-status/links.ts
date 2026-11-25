import { randomBytes } from 'crypto'

import type { SupabaseClient } from '@supabase/supabase-js'

import { orderStatusAbsoluteUrl } from '@/lib/order-status/format'
import type { OrderShareKind } from '@/lib/order-status/types'

const DEFAULT_TTL_DAYS = 30

function newToken(): string {
  return randomBytes(9).toString('base64url')
}

function expiresAtIso(days = DEFAULT_TTL_DAYS): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}

const REF_COLUMN: Record<OrderShareKind, string> = {
  cso: 'customer_special_order_id',
  quote: 'quote_id',
  manual: 'manual_order_id'
}

/**
 * Élő link biztosítása SMS-hez. A nem visszavont tokent (lejártat is) meghosszabbítja —
 * rendelésenként egy ilyen lehet (unique index), így lejárt link mellé nem lehet újat beszúrni.
 */
export async function ensureOrderShareLink(input: {
  supabase: SupabaseClient
  tenantId: string
  kind: OrderShareKind
  refId: string
  userId?: string | null
}): Promise<{ token: string; url: string } | null> {
  const { supabase, tenantId, kind, refId } = input
  const expiresAt = expiresAtIso()

  let existingQuery = supabase
    .from('order_share_links')
    .select('id, token')
    .eq('tenant_id', tenantId)
    .eq('kind', kind)
    .is('revoked_at', null)
    .limit(1)

  existingQuery = existingQuery.eq(REF_COLUMN[kind], refId)

  const { data: existing, error: existingError } = await existingQuery.maybeSingle()

  if (existingError) {
    console.error('ensureOrderShareLink select', existingError.message)
  }

  if (existing?.token) {
    const { error: touchError } = await supabase
      .from('order_share_links')
      .update({ expires_at: expiresAt })
      .eq('id', existing.id)
      .eq('tenant_id', tenantId)
    if (touchError) {
      console.error('ensureOrderShareLink touch', touchError.message)
    }
    return {
      token: existing.token as string,
      url: orderStatusAbsoluteUrl(existing.token as string)
    }
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const token = newToken()
    const row: Record<string, unknown> = {
      tenant_id: tenantId,
      kind,
      token,
      expires_at: expiresAt,
      created_by: input.userId ?? null,
      [REF_COLUMN[kind]]: refId
    }

    const { data: inserted, error } = await supabase
      .from('order_share_links')
      .insert(row)
      .select('token')
      .maybeSingle()

    if (!error && inserted?.token) {
      return {
        token: inserted.token as string,
        url: orderStatusAbsoluteUrl(inserted.token as string)
      }
    }

    // Unique aktív link race → újraolvasás
    if (error?.code === '23505') {
      const { data: raced } = await existingQuery.maybeSingle()
      if (raced?.token) {
        return {
          token: raced.token as string,
          url: orderStatusAbsoluteUrl(raced.token as string)
        }
      }
      continue
    }

    console.error('ensureOrderShareLink insert', error?.message)
    return null
  }

  return null
}

/** Rendelés törlésekor: a vevő linkje „lezárva” üzenetet mutasson. */
export async function revokeOrderShareLinks(input: {
  supabase: SupabaseClient
  tenantId: string
  kind: OrderShareKind
  refId: string
}): Promise<void> {
  const { error } = await input.supabase
    .from('order_share_links')
    .update({ revoked_at: new Date().toISOString() })
    .eq('tenant_id', input.tenantId)
    .eq(REF_COLUMN[input.kind], input.refId)
    .is('revoked_at', null)
  if (error && !error.message.includes('manual_order_id')) {
    console.error('revokeOrderShareLinks', error.message)
  }
}

export type OrderShareLinkInfo = {
  url: string
  firstOpenedAt: string | null
  lastOpenedAt: string | null
  openCount: number
}

/** Eladói nézet: van-e élő link, és megnyitotta-e a vevő. Migráció előtt null. */
export async function getOrderShareLinkInfo(input: {
  supabase: SupabaseClient
  tenantId: string
  kind: OrderShareKind
  refId: string
}): Promise<OrderShareLinkInfo | null> {
  const { data, error } = await input.supabase
    .from('order_share_links')
    .select('token, first_opened_at, last_opened_at, open_count')
    .eq('tenant_id', input.tenantId)
    .eq(REF_COLUMN[input.kind], input.refId)
    .is('revoked_at', null)
    .limit(1)
    .maybeSingle()
  if (error || !data?.token) return null
  return {
    url: orderStatusAbsoluteUrl(data.token as string),
    firstOpenedAt: (data.first_opened_at as string | null) ?? null,
    lastOpenedAt: (data.last_opened_at as string | null) ?? null,
    openCount: Number(data.open_count ?? 0)
  }
}
