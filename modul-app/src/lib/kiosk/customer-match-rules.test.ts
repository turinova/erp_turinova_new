/**
 * Run: npx tsx --test src/lib/kiosk/customer-match-rules.test.ts
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  isCustomerNameConflict,
  matchKindForCount,
  normalizeGuestName,
  normalizeHuPhone,
  phoneLast4,
  renamedCustomerName
} from './customer-match-rules'

describe('normalizeHuPhone', () => {
  it('egységes 36… alakra hoz minden gyakori formát', () => {
    const expected = '36301234567'
    for (const raw of [
      '+36 30 123 4567',
      '+36301234567',
      '06301234567',
      '06 30 123 4567',
      '0036 30 123 4567',
      '301234567',
      '+36-30-123-4567'
    ]) {
      assert.equal(normalizeHuPhone(raw), expected, raw)
    }
  })

  it('üres / null → null', () => {
    assert.equal(normalizeHuPhone(''), null)
    assert.equal(normalizeHuPhone(null), null)
    assert.equal(normalizeHuPhone('  '), null)
  })

  it('vezetékes / ismeretlen formát nem torzít', () => {
    assert.equal(normalizeHuPhone('+36 1 234 5678'), '3612345678')
  })
})

describe('matchKindForCount', () => {
  it('0 → nincs egyezés, 1 → phone, több → phone_multiple', () => {
    assert.equal(matchKindForCount(0), null)
    assert.equal(matchKindForCount(1), 'phone')
    assert.equal(matchKindForCount(3), 'phone_multiple')
  })
})

describe('név', () => {
  it('normalizeGuestName: trim + szóközök', () => {
    assert.equal(normalizeGuestName('  Kovács   Péter '), 'Kovács Péter')
  })

  it('renamedCustomerName: 1. telefonszám vége, 2. teljes szám', () => {
    assert.equal(
      renamedCustomerName('Kovács Péter', '+36 30 123 4567', 1),
      'Kovács Péter (…4567)'
    )
    assert.equal(
      renamedCustomerName('Kovács Péter', '+36 30 123 4567', 2),
      'Kovács Péter (+36 30 123 4567)'
    )
  })

  it('phoneLast4', () => {
    assert.equal(phoneLast4('+36 30 123 4567'), '4567')
    assert.equal(phoneLast4(null), '')
  })
})

describe('isCustomerNameConflict', () => {
  it('csak a név unique index ütközés számít', () => {
    assert.equal(
      isCustomerNameConflict({
        code: '23505',
        message:
          'duplicate key value violates unique constraint "customers_tenant_name_staff_alive_uidx"'
      }),
      true
    )
    assert.equal(
      isCustomerNameConflict({ code: '23505', message: 'other_uidx' }),
      false
    )
    assert.equal(isCustomerNameConflict({ code: '42501', message: '' }), false)
    assert.equal(isCustomerNameConflict(null), false)
  })
})
