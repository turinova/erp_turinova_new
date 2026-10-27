/**
 * Run: npx tsx --test src/lib/sms/simplesms-phone.test.ts
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { splitSimpleSmsPhone } from './simplesms'

describe('splitSimpleSmsPhone', () => {
  it('splits +36 Telekom mobile', () => {
    assert.deepEqual(splitSimpleSmsPhone('+36301234567'), {
      country_code: '36',
      area_code: '30',
      number: '1234567'
    })
  })

  it('splits 06 Yettel trunk', () => {
    assert.deepEqual(splitSimpleSmsPhone('06 20 123 4567'), {
      country_code: '36',
      area_code: '20',
      number: '1234567'
    })
  })

  it('keeps international country code with +', () => {
    assert.deepEqual(splitSimpleSmsPhone('+43664123456'), {
      country_code: '43',
      area_code: '66',
      number: '4123456'
    })
  })
})
