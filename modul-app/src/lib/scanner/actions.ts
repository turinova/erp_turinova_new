'use server'

import { revalidatePath } from 'next/cache'

import {
  finishQuoteHandover,
  markQuoteReady
} from '@/lib/quotes/production-actions'
import type { QuoteReadySmsResult } from '@/lib/sms/send-ready'
import { listQuoteReadySmsCandidates } from '@/lib/sms/send-ready'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'

const SCANNER_PATH = '/scanner'
const ORDERS_PATH = '/megrendelesek'
const LIST_PATH = '/ajanlatok'
const HOME_PATH = '/home'

function revalidateScannerPaths() {
  revalidatePath(SCANNER_PATH)
  revalidatePath(ORDERS_PATH)
  revalidatePath(LIST_PATH)
  revalidatePath(HOME_PATH)
}

export type BulkItemResult = {
  id: string
  ok: boolean
  message?: string
  paymentCreated?: boolean
  sms?: QuoteReadySmsResult | null
}

export type BulkActionResult = {
  ok: boolean
  results: BulkItemResult[]
  successCount: number
  failCount: number
  smsSentCount: number
  smsFailedCount: number
}

export async function previewQuoteReadySms(quoteIds: string[]) {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false as const, message: ctx.message }

  try {
    const preview = await listQuoteReadySmsCandidates(
      ctx.supabase,
      ctx.user.tenantId!,
      quoteIds
    )
    return { ok: true as const, ...preview }
  } catch (err) {
    return {
      ok: false as const,
      message:
        err instanceof Error
          ? err.message
          : 'Nem sikerült betölteni az SMS előnézetet.'
    }
  }
}

export async function markQuotesReadyBulk(input: {
  quoteIds: string[]
  /** Quote IDs that should receive SMS (subset of quoteIds). */
  smsQuoteIds?: string[]
}): Promise<BulkActionResult> {
  const uniqueIds = [...new Set(input.quoteIds.filter(Boolean))]
  const smsSet = new Set(input.smsQuoteIds ?? [])
  const results: BulkItemResult[] = []

  for (const id of uniqueIds) {
    const wantsSms = smsSet.has(id)
    const result = await markQuoteReady(
      id,
      wantsSms || input.smsQuoteIds !== undefined
        ? { sendSms: wantsSms }
        : undefined
    )
    if (result.ok) {
      results.push({ id, ok: true, sms: result.sms })
    } else {
      results.push({ id, ok: false, message: result.message })
    }
  }

  const successCount = results.filter((r) => r.ok).length
  const smsSentCount = results.filter((r) => r.sms?.status === 'sent').length
  const smsFailedCount = results.filter((r) => r.sms?.status === 'failed')
    .length

  if (successCount > 0) revalidateScannerPaths()

  return {
    ok: successCount > 0,
    results,
    successCount,
    failCount: results.length - successCount,
    smsSentCount,
    smsFailedCount
  }
}

export async function finishQuotesHandoverBulk(input: {
  quoteIds: string[]
  settleRemaining: boolean
  paymentMethodId?: string
}): Promise<BulkActionResult> {
  const uniqueIds = [...new Set(input.quoteIds.filter(Boolean))]
  const results: BulkItemResult[] = []

  for (const id of uniqueIds) {
    const result = await finishQuoteHandover({
      quoteId: id,
      settleRemaining: input.settleRemaining,
      paymentMethodId: input.paymentMethodId
    })
    if (result.ok) {
      results.push({
        id,
        ok: true,
        paymentCreated: result.paymentCreated
      })
    } else {
      results.push({ id, ok: false, message: result.message })
    }
  }

  const successCount = results.filter((r) => r.ok).length
  if (successCount > 0) revalidateScannerPaths()

  return {
    ok: successCount > 0,
    results,
    successCount,
    failCount: results.length - successCount,
    smsSentCount: 0,
    smsFailedCount: 0
  }
}
