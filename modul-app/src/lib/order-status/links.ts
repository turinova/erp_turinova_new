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

/**
 * Élő link biztosítása SMS-hez. Meglévő aktív tokent meghosszabbít;
 * ha nincs, újat hoz létre.
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
    .gt('expires_at', new Date().toISOString())
    .limit(1)

  existingQuery =
    kind === 'cso'
      ? existingQuery.eq('customer_special_order_id', refId)
      : existingQuery.eq('quote_id', refId)

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
      customer_special_order_id: kind === 'cso' ? refId : null,
      quote_id: kind === 'quote' ? refId : null
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
