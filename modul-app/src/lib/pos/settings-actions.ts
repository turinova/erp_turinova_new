'use server'

import { revalidatePath } from 'next/cache'

import { getSessionUser } from '@/lib/auth/session'
import { getOrCreatePosSettings } from '@/lib/pos/settings'
import {
  isTeyaReady,
  toPublicPosConfig,
  type PosCardProvider,
  type PosPayModeSetting,
  type PosStockPolicy,
  type PosTerminalPublicConfig,
  type TenantPosSettings,
  type TeyaEnv
} from '@/lib/pos/settings-types'
import {
  cancelTeyaPaymentRequest,
  createTeyaPaymentRequest,
  getTeyaPaymentRequestStatus,
  isTerminalStatus,
  testTeyaCredentials,
  type TeyaCredentials,
  type TeyaPaymentStatus
} from '@/lib/pos/teya/client'
import { createClient } from '@/lib/supabase/server'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'

export type PosSettingsActionResult =
  | { ok: true; message?: string }
  | { ok: false; message: string }

function credsFromSettings(s: {
  teya_env: TeyaEnv
  teya_client_id: string | null
  teya_client_secret: string | null
  teya_store_id: string | null
  teya_terminal_id: string | null
  teya_epos_instance_id: string
}): TeyaCredentials | null {
  if (
    !s.teya_client_id?.trim() ||
    !s.teya_client_secret?.trim() ||
    !s.teya_store_id?.trim() ||
    !s.teya_terminal_id?.trim()
  ) {
    return null
  }
  return {
    env: s.teya_env,
    clientId: s.teya_client_id.trim(),
    clientSecret: s.teya_client_secret.trim(),
    storeId: s.teya_store_id.trim(),
    terminalId: s.teya_terminal_id.trim(),
    eposInstanceId: (s.teya_epos_instance_id || 'modul-pos').trim()
  }
}

export async function loadPosSettingsAction(): Promise<
  | { ok: true; settings: TenantPosSettings; canWrite: boolean }
  | { ok: false; message: string }
> {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return { ok: false, message: 'Nincs munkamenet.' }
  }
  const supabase = await createClient()
  if (!supabase) return { ok: false, message: 'Nincs adatbázis kapcsolat.' }

  try {
    const settings = await getOrCreatePosSettings(supabase, user.tenantId)
    return {
      ok: true,
      settings,
      canWrite: Boolean(user.role && user.role !== 'viewer')
    }
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : 'Nem sikerült betölteni a beállításokat.'
    }
  }
}

export async function getPosTerminalPublicConfigAction(): Promise<PosTerminalPublicConfig> {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return toPublicPosConfig(null)
  }
  const supabase = await createClient()
  if (!supabase) return toPublicPosConfig(null)
  try {
    const settings = await getOrCreatePosSettings(supabase, user.tenantId)
    return toPublicPosConfig(settings)
  } catch {
    return toPublicPosConfig(null)
  }
}

export async function savePosSettingsAction(input: {
  cardProvider: PosCardProvider
  teyaEnv: TeyaEnv
  teyaStoreId: string
  teyaTerminalId: string
  teyaClientId: string
  /** Üres = megtartjuk a meglévő secretet. */
  teyaClientSecret: string
  teyaEposInstanceId: string
  allowCash: boolean
  allowCard: boolean
  allowSplit: boolean
  defaultPayMode: PosPayModeSetting | null
  stockPolicy: PosStockPolicy
  maxDiscountPercent: number
  showInvoiceButton: boolean
  requireCustomer: boolean
  /** Ha megadva: pénztár Teya override mentése. */
  registerId?: string | null
  registerTeyaTerminalId?: string
  registerTeyaEposInstanceId?: string
}): Promise<PosSettingsActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const existing = await getOrCreatePosSettings(
    ctx.supabase,
    ctx.user.tenantId!
  )

  const secret =
    input.teyaClientSecret.trim() || existing.teya_client_secret?.trim() || null

  if (!input.allowCash && !input.allowCard) {
    return {
      ok: false,
      message: 'Legalább a készpénz vagy a kártya legyen engedélyezve.'
    }
  }

  if (input.allowSplit && (!input.allowCash || !input.allowCard)) {
    return {
      ok: false,
      message: 'Vegyes fizetéshez kell készpénz és kártya is.'
    }
  }

  if (
    input.defaultPayMode === 'cash' &&
    !input.allowCash
  ) {
    return { ok: false, message: 'Az alapértelmezett mód nincs engedélyezve.' }
  }
  if (input.defaultPayMode === 'card' && !input.allowCard) {
    return { ok: false, message: 'Az alapértelmezett mód nincs engedélyezve.' }
  }
  if (input.defaultPayMode === 'split' && !input.allowSplit) {
    return { ok: false, message: 'Az alapértelmezett mód nincs engedélyezve.' }
  }

  const maxDisc = Math.min(
    100,
    Math.max(0, Math.round(Number(input.maxDiscountPercent) || 0))
  )

  if (input.cardProvider === 'teya') {
    if (!input.teyaStoreId.trim()) {
      return { ok: false, message: 'A Teya üzlet azonosító kötelező.' }
    }
    if (!input.teyaTerminalId.trim()) {
      return {
        ok: false,
        message: 'A Teya terminál azonosító kötelező (tenant alapértelmezés).'
      }
    }
    if (!input.teyaClientId.trim()) {
      return { ok: false, message: 'A Teya kliens azonosító kötelező.' }
    }
    if (!secret) {
      return { ok: false, message: 'A Teya titkos kulcs kötelező.' }
    }
  }

  const { error } = await ctx.supabase
    .from('tenant_pos_settings')
    .update({
      card_provider: input.cardProvider,
      teya_env: input.teyaEnv,
      teya_store_id: input.teyaStoreId.trim() || null,
      teya_terminal_id: input.teyaTerminalId.trim() || null,
      teya_client_id: input.teyaClientId.trim() || null,
      teya_client_secret: secret,
      teya_epos_instance_id:
        input.teyaEposInstanceId.trim() || 'modul-pos',
      allow_cash: input.allowCash,
      allow_card: input.allowCard,
      allow_split: input.allowSplit,
      default_pay_mode: input.defaultPayMode,
      stock_policy: input.stockPolicy,
      max_discount_percent: maxDisc,
      show_invoice_button: input.showInvoiceButton,
      require_customer: input.requireCustomer,
      updated_at: new Date().toISOString()
    })
    .eq('tenant_id', ctx.user.tenantId!)

  if (error) {
    console.error('savePosSettingsAction', error.message)
    return { ok: false, message: 'Nem sikerült menteni a beállításokat.' }
  }

  if (input.registerId) {
    const { error: regErr } = await ctx.supabase
      .from('pos_registers')
      .update({
        teya_terminal_id: input.registerTeyaTerminalId?.trim() || null,
        teya_epos_instance_id:
          input.registerTeyaEposInstanceId?.trim() || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', input.registerId)
      .eq('tenant_id', ctx.user.tenantId!)

    if (regErr) {
      console.error('savePosSettingsAction register', regErr.message)
      return {
        ok: false,
        message: 'Beállítások mentve, de a pénztár Teya adatai nem.'
      }
    }
  }

  revalidatePath('/pos')
  return { ok: true, message: 'Beállítások mentve.' }
}

export async function testPosTeyaConnectionAction(): Promise<PosSettingsActionResult> {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return { ok: false, message: 'Nincs munkamenet.' }
  }
  const supabase = await createClient()
  if (!supabase) return { ok: false, message: 'Nincs adatbázis kapcsolat.' }

  const settings = await getOrCreatePosSettings(supabase, user.tenantId)
  const creds = credsFromSettings(settings)
  if (!creds) {
    return {
      ok: false,
      message: 'Előbb mentsd el a Teya store / terminal / client adatokat.'
    }
  }

  const result = await testTeyaCredentials(creds)
  if (!result.ok) return { ok: false, message: result.message }
  return { ok: true, message: 'A Teya OAuth kapcsolat rendben van.' }
}

export type TeyaChargeStartResult =
  | { ok: true; paymentRequestId: string; status: TeyaPaymentStatus }
  | { ok: false; message: string }

export async function startTeyaCardChargeAction(input: {
  amountHuf: number
  merchantReference: string
  /** Pénztár — Teya terminal / ePOS override. */
  registerId?: string | null
}): Promise<TeyaChargeStartResult> {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return { ok: false, message: 'Nincs munkamenet.' }
  }
  if (!(user.role && user.role !== 'viewer')) {
    return { ok: false, message: 'Nincs írási jogosultság.' }
  }
  const supabase = await createClient()
  if (!supabase) return { ok: false, message: 'Nincs adatbázis kapcsolat.' }

  const settings = await getOrCreatePosSettings(supabase, user.tenantId)
  if (!isTeyaReady(settings)) {
    return {
      ok: false,
      message:
        'A Teya nincs beállítva. Nyisd meg a POS beállításokat, vagy válaszd a kézi terminált.'
    }
  }
  const creds = credsFromSettings(settings)
  if (!creds) {
    return { ok: false, message: 'Hiányos Teya konfiguráció.' }
  }

  if (input.registerId) {
    const { data: reg } = await supabase
      .from('pos_registers')
      .select('teya_terminal_id, teya_epos_instance_id')
      .eq('id', input.registerId)
      .eq('tenant_id', user.tenantId)
      .maybeSingle()
    if (reg?.teya_terminal_id?.trim()) {
      creds.terminalId = reg.teya_terminal_id.trim()
    }
    if (reg?.teya_epos_instance_id?.trim()) {
      creds.eposInstanceId = reg.teya_epos_instance_id.trim()
    }
  }

  try {
    const created = await createTeyaPaymentRequest(creds, {
      amountHuf: input.amountHuf,
      merchantReference: input.merchantReference,
      idempotencyKey: input.merchantReference
    })
    return {
      ok: true,
      paymentRequestId: created.payment_request_id,
      status: created.status
    }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Teya indítás sikertelen.'
    }
  }
}

export type TeyaChargeStatusResult =
  | {
      ok: true
      status: TeyaPaymentStatus
      done: boolean
      providerRef: string | null
      authCode: string | null
    }
  | { ok: false; message: string }

export async function pollTeyaCardChargeAction(input: {
  paymentRequestId: string
}): Promise<TeyaChargeStatusResult> {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return { ok: false, message: 'Nincs munkamenet.' }
  }
  const supabase = await createClient()
  if (!supabase) return { ok: false, message: 'Nincs adatbázis kapcsolat.' }

  const settings = await getOrCreatePosSettings(supabase, user.tenantId)
  const creds = credsFromSettings(settings)
  if (!creds) return { ok: false, message: 'Hiányos Teya konfiguráció.' }

  try {
    const row = await getTeyaPaymentRequestStatus(
      creds,
      input.paymentRequestId
    )
    const done = isTerminalStatus(row.status)
    const ref =
      row.gateway_payment_id ||
      row.source_reference_id ||
      row.payment_request_id
    return {
      ok: true,
      status: row.status,
      done,
      providerRef: done && row.status === 'SUCCESSFUL' ? `teya:${ref}` : null,
      authCode:
        done && row.status === 'SUCCESSFUL'
          ? row.source_reference_id || row.gateway_payment_id || null
          : null
    }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Teya státusz hiba.'
    }
  }
}

export async function cancelTeyaCardChargeAction(input: {
  paymentRequestId: string
}): Promise<PosSettingsActionResult> {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return { ok: false, message: 'Nincs munkamenet.' }
  }
  const supabase = await createClient()
  if (!supabase) return { ok: false, message: 'Nincs adatbázis kapcsolat.' }

  const settings = await getOrCreatePosSettings(supabase, user.tenantId)
  const creds = credsFromSettings(settings)
  if (!creds) return { ok: false, message: 'Hiányos Teya konfiguráció.' }

  try {
    await cancelTeyaPaymentRequest(creds, input.paymentRequestId)
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Mégsem sikertelen.'
    }
  }
}
