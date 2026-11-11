/**
 * Run: npx tsx --test src/lib/order-status/record-open.test.ts
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  formatReadySmsInfoLine,
  shouldRecordOrderShareOpen
} from './record-open'

function headers(map: Record<string, string>) {
  return {
    get(name: string) {
      return map[name.toLowerCase()] ?? null
    }
  }
}

describe('shouldRecordOrderShareOpen', () => {
  it('skips prefetch and preview bots', () => {
    assert.equal(
      shouldRecordOrderShareOpen(headers({ purpose: 'prefetch' })),
      false
    )
    assert.equal(
      shouldRecordOrderShareOpen(
        headers({ 'sec-purpose': 'prefetch', 'user-agent': 'Mozilla/5.0' })
      ),
      false
    )
    assert.equal(
      shouldRecordOrderShareOpen(
        headers({ 'user-agent': 'WhatsApp/2.23' })
      ),
      false
    )
    assert.equal(shouldRecordOrderShareOpen(headers({})), false)
  })

  it('allows real mobile browsers', () => {
    assert.equal(
      shouldRecordOrderShareOpen(
        headers({
          'user-agent':
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
        })
      ),
      true
    )
  })
})

describe('formatReadySmsInfoLine', () => {
  const fmt = (iso: string) => iso.slice(0, 16).replace('T', ' ')

  it('not sent / sent unopened / opened', () => {
    assert.equal(
      formatReadySmsInfoLine({
        sentAt: null,
        firstOpenedAt: null,
        formatDateTime: fmt
      }),
      'még nem ment ki'
    )
    assert.equal(
      formatReadySmsInfoLine({
        sentAt: '2026-11-11T10:00:00Z',
        firstOpenedAt: null,
        formatDateTime: fmt
      }),
      'elküldve 2026-11-11 10:00 · még nem nyitotta meg'
    )
    assert.equal(
      formatReadySmsInfoLine({
        sentAt: '2026-11-11T10:00:00Z',
        firstOpenedAt: '2026-11-11T10:05:00Z',
        formatDateTime: fmt
      }),
      'elküldve 2026-11-11 10:00 · megnyitva 2026-11-11 10:05'
    )
  })
})
