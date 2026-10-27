/**
 * Run: npx tsx --test src/lib/quotes/payment-labels.test.ts
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  formatPaymentAmountInput,
  quoteOverpaidGross,
  quoteRemainingGross,
  roundQuoteMoney
} from './payment-labels'

describe('roundQuoteMoney', () => {
  it('rounds float ÁFA noise to whole Ft', () => {
    assert.equal(roundQuoteMoney(199999.8), 200000)
    assert.equal(roundQuoteMoney(200000.2), 200000)
    assert.equal(roundQuoteMoney(200000.5), 200001)
  })
})

describe('quoteRemainingGross', () => {
  it('prefills as whole Ft when gross has float dirt', () => {
    assert.equal(quoteRemainingGross(199999.8, 0), 200000)
    assert.equal(formatPaymentAmountInput(quoteRemainingGross(199999.8, 0)), '200000')
  })

  it('handles partial paid with float sum', () => {
    assert.equal(quoteRemainingGross(250000.2, 50000.4), 200000)
  })

  it('returns 0 when paid covers (within round)', () => {
    assert.equal(quoteRemainingGross(200000, 199999.6), 0)
  })
})

describe('quoteOverpaidGross', () => {
  it('rounds overpay to whole Ft', () => {
    assert.equal(quoteOverpaidGross(199999.8, 200000.3), 1)
  })
})
