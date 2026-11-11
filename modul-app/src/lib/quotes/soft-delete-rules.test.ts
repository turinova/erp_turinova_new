/**
 * Run: npx tsx --test src/lib/quotes/soft-delete-rules.test.ts
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  canSoftDeleteQuote,
  softDeleteQuoteBlocker
} from './soft-delete-rules'

describe('softDeleteQuoteBlocker', () => {
  const base = {
    status: 'draft',
    orderNumber: null as string | null,
    portalSubmittedAt: null as string | null,
    hasActiveInvoice: false,
    hasPayments: false
  }

  it('allows plain staff draft', () => {
    assert.equal(softDeleteQuoteBlocker(base), null)
    assert.equal(canSoftDeleteQuote(base), true)
  })

  it('blocks orders', () => {
    assert.match(
      softDeleteQuoteBlocker({ ...base, orderNumber: 'O-1' }) ?? '',
      /Megrendelést mondj le/
    )
  })

  it('blocks portal submitted (archive instead)', () => {
    assert.match(
      softDeleteQuoteBlocker({
        ...base,
        portalSubmittedAt: '2026-01-01T00:00:00Z'
      }) ?? '',
      /archívumba/
    )
  })

  it('blocks active invoice', () => {
    assert.match(
      softDeleteQuoteBlocker({ ...base, hasActiveInvoice: true }) ?? '',
      /aktív bizonylat/
    )
  })

  it('blocks payments', () => {
    assert.match(
      softDeleteQuoteBlocker({ ...base, hasPayments: true }) ?? '',
      /befizetés/
    )
  })
})
