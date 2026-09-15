'use server'

import { revalidatePath } from 'next/cache'

import {
  finishQuoteHandover,
  markQuoteReady
} from '@/lib/quotes/production-actions'

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
}

export type BulkActionResult = {
  ok: boolean
  results: BulkItemResult[]
  successCount: number
  failCount: number
}

export async function markQuotesReadyBulk(
  quoteIds: string[]
): Promise<BulkActionResult> {
  const uniqueIds = [...new Set(quoteIds.filter(Boolean))]
  const results: BulkItemResult[] = []

  for (const id of uniqueIds) {
    const result = await markQuoteReady(id)
    if (result.ok) {
      results.push({ id, ok: true })
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
    failCount: results.length - successCount
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
    failCount: results.length - successCount
  }
}
