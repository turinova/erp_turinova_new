/**
 * Run: npx tsx --test src/lib/invoicing/szamlazz-email-templates.test.ts
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  invoiceEmailTemplate,
  stornoEmailTemplate,
  type InvoiceEmailContext
} from './szamlazz-email-templates'

const KNOWN_TAGS = new Set([
  'bankszámlaszám',
  'bank',
  'fizmod',
  'határidő',
  'kelt',
  'nettó',
  'összeg',
  'rendelésszám',
  'számlaszám',
  'tartozás',
  'vevőneve',
  'cégnév'
])
const BB = new Set(['b', '/b', 'i', '/i', 'u', '/u', 'center', '/center'])

const cases: Array<[string, InvoiceEmailContext]> = [
  ['paid', { kind: 'normal', paid: true, afterAdvance: false, paymentMethod: 'card' }],
  ['open transfer', { kind: 'normal', paid: false, afterAdvance: false, paymentMethod: 'bank_transfer' }],
  ['open cash', { kind: 'normal', paid: false, afterAdvance: false, paymentMethod: 'cash' }],
  ['final paid', { kind: 'normal', paid: true, afterAdvance: true, paymentMethod: 'bank_transfer' }],
  ['final open', { kind: 'normal', paid: false, afterAdvance: true, paymentMethod: 'bank_transfer' }],
  ['proforma', { kind: 'proforma', paid: false, afterAdvance: false, paymentMethod: 'bank_transfer' }],
  ['advance', { kind: 'advance', paid: false, afterAdvance: false, paymentMethod: 'bank_transfer' }]
]

function assertClean(t: { subject: string; body: string }) {
  for (const text of [t.subject, t.body]) {
    assert.ok(!/[—–]| - /.test(text), `dash in: ${text}`)
    for (const m of text.matchAll(/\[([^\]]+)\]/g)) {
      const tag = m[1]!
      assert.ok(KNOWN_TAGS.has(tag) || BB.has(tag), `unknown tag [${tag}]`)
    }
  }
}

describe('invoiceEmailTemplate', () => {
  for (const [label, ctx] of cases) {
    it(`${label}: only known tags, no dashes`, () => {
      assertClean(invoiceEmailTemplate(ctx))
    })
  }

  it('paid invoice never asks for payment', () => {
    const t = invoiceEmailTemplate(cases[0]![1])
    assert.ok(!t.body.includes('[tartozás]'))
    assert.ok(!t.body.includes('[bankszámlaszám]'))
  })

  it('open transfer shows bank details and outstanding amount', () => {
    const t = invoiceEmailTemplate(cases[1]![1])
    assert.ok(t.body.includes('[tartozás]'))
    assert.ok(t.body.includes('[bankszámlaszám]'))
  })

  it('cash invoice has no bank account line', () => {
    assert.ok(!invoiceEmailTemplate(cases[2]![1]).body.includes('[bankszámlaszám]'))
  })

  it('proforma says it is not an invoice', () => {
    assert.match(invoiceEmailTemplate(cases[5]![1]).body, /nem számla/)
  })

  it('storno template is clean', () => {
    assertClean(stornoEmailTemplate())
  })
})
