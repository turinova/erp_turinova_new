/**
 * Ügyfélrendelés következő lépés — vegyes státusz + blocked.
 * Run: npx tsx --test src/lib/customer-orders/cso-next-step.test.ts
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  csoBlockedCtaLabel,
  csoComputeNextStep,
  type CsoPoStatus
} from './types'

function item(partial: {
  id: string
  status: 'felveve' | 'rendelve' | 'itt_van' | 'atadva' | 'torolve'
  accessoryId?: string | null
  supplierId?: string | null
  poId?: string | null
  poNumber?: string | null
  poStatus?: CsoPoStatus | null
}) {
  return {
    id: partial.id,
    status: partial.status,
    accessoryId: partial.accessoryId ?? null,
    supplierId: partial.supplierId ?? null,
    poId: partial.poId ?? null,
    poNumber: partial.poNumber ?? null,
    poStatus: partial.poStatus ?? null
  }
}

describe('csoComputeNextStep', () => {
  it('1 leadable → lead, no also', () => {
    const step = csoComputeNextStep({
      smsSentAt: null,
      items: [
        item({
          id: 'a',
          status: 'felveve',
          accessoryId: 'acc',
          supplierId: 'sup'
        })
      ]
    })
    assert.equal(step?.kind, 'lead')
    assert.equal(step?.also, undefined)
  })

  it('1 blocked (no supplier) → blocked + focusItemId', () => {
    const step = csoComputeNextStep({
      smsSentAt: null,
      items: [
        item({
          id: 'b1',
          status: 'felveve',
          accessoryId: 'acc',
          supplierId: null
        })
      ]
    })
    assert.equal(step?.kind, 'blocked')
    assert.equal(step?.focusItemId, 'b1')
    assert.match(step?.body ?? '', /beszállító/i)
    assert.equal(csoBlockedCtaLabel(step ? [{ status: 'felveve', accessoryId: 'acc', supplierId: null }] : []), 'Válassz beszállítót')
  })

  it('on_way draft + leadable → send_po + also lead', () => {
    const step = csoComputeNextStep({
      smsSentAt: null,
      items: [
        item({
          id: 'ow',
          status: 'rendelve',
          poId: 'po1',
          poNumber: 'PO-1',
          poStatus: 'draft'
        }),
        item({
          id: 'ld',
          status: 'felveve',
          accessoryId: 'acc',
          supplierId: 'sup'
        })
      ]
    })
    assert.equal(step?.kind, 'send_po')
    assert.equal(step?.also?.kind, 'lead')
    assert.equal(step?.also?.count, 1)
  })

  it('ready + no SMS → handover primary + suggestSms + also sms', () => {
    const step = csoComputeNextStep({
      smsSentAt: null,
      items: [item({ id: 'r', status: 'itt_van' })]
    })
    assert.equal(step?.kind, 'handover')
    assert.equal(step?.suggestSms, true)
    assert.equal(step?.also?.kind, 'sms')
  })

  it('ready + leadable + no SMS → handover + also lead + suggestSms', () => {
    const step = csoComputeNextStep({
      smsSentAt: null,
      items: [
        item({ id: 'r', status: 'itt_van' }),
        item({
          id: 'ld',
          status: 'felveve',
          accessoryId: 'acc',
          supplierId: 'sup'
        })
      ]
    })
    assert.equal(step?.kind, 'handover')
    assert.equal(step?.suggestSms, true)
    assert.equal(step?.also?.kind, 'lead')
    assert.equal(step?.also?.count, 1)
  })

  it('ready + sms sent + blocked → handover + also blocked, no suggestSms', () => {
    const step = csoComputeNextStep({
      smsSentAt: '2026-01-01T10:00:00Z',
      items: [
        item({ id: 'r', status: 'itt_van' }),
        item({
          id: 'bl',
          status: 'felveve',
          accessoryId: null,
          supplierId: null
        })
      ]
    })
    assert.equal(step?.kind, 'handover')
    assert.equal(step?.suggestSms, false)
    assert.equal(step?.also?.kind, 'blocked')
    assert.equal(step?.also?.focusItemId, 'bl')
  })

  it('on_way ordered + blocked → receive + also blocked', () => {
    const step = csoComputeNextStep({
      smsSentAt: null,
      items: [
        item({
          id: 'ow',
          status: 'rendelve',
          poId: 'po1',
          poNumber: 'PO-1',
          poStatus: 'ordered'
        }),
        item({
          id: 'bl',
          status: 'felveve',
          accessoryId: 'acc',
          supplierId: null
        })
      ]
    })
    assert.equal(step?.kind, 'receive')
    assert.equal(step?.also?.kind, 'blocked')
    assert.equal(step?.also?.count, 1)
  })

  it('leadable + blocked → lead + also blocked', () => {
    const step = csoComputeNextStep({
      smsSentAt: null,
      items: [
        item({
          id: 'ld',
          status: 'felveve',
          accessoryId: 'acc',
          supplierId: 'sup'
        }),
        item({
          id: 'bl',
          status: 'felveve',
          accessoryId: null,
          supplierId: null
        })
      ]
    })
    assert.equal(step?.kind, 'lead')
    assert.equal(step?.also?.kind, 'blocked')
    assert.equal(step?.also?.focusItemId, 'bl')
  })

  it('all atadva → done', () => {
    const step = csoComputeNextStep({
      smsSentAt: null,
      items: [item({ id: 'x', status: 'atadva' })]
    })
    assert.equal(step?.kind, 'done')
    assert.equal(step?.also, undefined)
  })

  it('also prefers leadable over blocked when both remain', () => {
    const step = csoComputeNextStep({
      smsSentAt: null,
      items: [
        item({
          id: 'ow',
          status: 'rendelve',
          poId: 'po1',
          poNumber: 'PO-1',
          poStatus: 'ordered'
        }),
        item({
          id: 'ld',
          status: 'felveve',
          accessoryId: 'acc',
          supplierId: 'sup'
        }),
        item({
          id: 'bl',
          status: 'felveve',
          accessoryId: null,
          supplierId: null
        })
      ]
    })
    assert.equal(step?.kind, 'receive')
    assert.equal(step?.also?.kind, 'lead')
    assert.equal(step?.also?.count, 1)
  })
})
