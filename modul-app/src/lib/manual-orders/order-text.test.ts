/**
 * Run: npx tsx --test src/lib/manual-orders/order-text.test.ts
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildOrderTextBlocks } from './order-text'
import { moActionApplicable, moNextAction } from './types'

describe('buildOrderTextBlocks', () => {
  it('groups by supplier and numbers lines', () => {
    const blocks = buildOrderTextBlocks(
      [
        { supplierName: 'Hettich', name: 'Fogantyú', sku: 'FG-1', qty: 4, unitShortform: 'db' },
        { supplierName: 'Blum', name: 'Pánt', sku: null, qty: 10, unitShortform: 'db' },
        { supplierName: 'Hettich', name: 'Sín', sku: '', qty: 1.5, unitShortform: 'm' }
      ],
      'Hírös Ablak'
    )
    assert.equal(blocks.length, 2)
    assert.equal(blocks[0].supplierName, 'Blum')
    const hettich = blocks[1]
    assert.equal(hettich.lineCount, 2)
    assert.match(hettich.text, /Kedves Hettich!/)
    assert.match(hettich.text, /1\. Fogantyú – FG-1 – 4 db/)
    assert.match(hettich.text, /2\. Sín – 1,5 m/)
    assert.match(hettich.text, /Hírös Ablak$/)
  })

  it('merges the same product across customers', () => {
    const [b] = buildOrderTextBlocks(
      [
        { supplierName: 'Forest', name: 'FA03 profil', sku: 'FA03', qty: 5, unitShortform: 'Fm' },
        { supplierName: 'Forest', name: 'FA03 profil (vevő 2)', sku: 'fa03', qty: 3, unitShortform: 'Fm' },
        { supplierName: 'Forest', name: 'Gomb', sku: null, qty: 2, unitShortform: 'db' }
      ],
      ''
    )
    assert.equal(b.lineCount, 2)
    assert.match(b.text, /1\. FA03 profil – FA03 – 8 Fm \(5 \+ 3\)/)
  })

  it('uses supplier intro, supplier sku and mail meta', () => {
    const [b] = buildOrderTextBlocks(
      [
        {
          supplierId: 's1',
          supplierName: 'Hranipex',
          name: 'Kábelátvezető',
          sku: 'F005559',
          supplierSku: 'HR-123',
          qty: 1,
          unitShortform: 'db',
          shopUrl: 'https://shop.example/?q=HR-123'
        }
      ],
      'Hírös Ablak',
      new Map([['s1', { email: 'info@hr.hu', phone: null, intro: '<p>Jó napot!</p>Kérjük:', preferred: 'email' as const }]])
    )
    assert.match(b.text, /^Jó napot!\n\nKérjük:\n\n1\. Kábelátvezető – HR-123 – 1 db/)
    assert.equal(b.email, 'info@hr.hu')
    assert.match(b.subject, /^Megrendelés – Hírös Ablak – /)
    assert.equal(b.links[0]?.url, 'https://shop.example/?q=HR-123')
  })

  it('handles missing supplier', () => {
    const [b] = buildOrderTextBlocks(
      [{ supplierName: null, name: 'Gomb', sku: null, qty: 6, unitShortform: 'db' }],
      ''
    )
    assert.equal(b.supplierName, 'Beszállító nélkül')
    assert.match(b.text, /Kedves Partnerünk!/)
  })
})

describe('moActionApplicable', () => {
  it('filters to statuses the action is valid from', () => {
    assert.deepEqual(
      moActionApplicable('atadva', ['nyitott', 'megerkezett', 'megerkezett']),
      ['megerkezett', 'megerkezett']
    )
    assert.deepEqual(moActionApplicable('megrendelve', ['megrendelve']), [])
  })

  it('next action follows the fixed order', () => {
    assert.equal(moNextAction('nyitott'), 'megrendelve')
    assert.equal(moNextAction('megerkezett'), 'atadva')
    assert.equal(moNextAction('atadva'), null)
  })
})

it('bevezető sorrend: beszállító → cég → beépített', () => {
  const line = { supplierId: 's1', supplierName: 'Forest', name: 'Csavar', sku: null, qty: 1, unitShortform: 'db' }
  const withCompany = buildOrderTextBlocks([line], 'Cég', new Map(), new Date(), 'Tisztelt Partnerünk!')
  assert.equal(withCompany[0].introSource, 'company')
  assert.match(withCompany[0].text, /^Tisztelt Partnerünk!/)
  assert.equal(withCompany[0].missingCodeCount, 1)
  const withSupplier = buildOrderTextBlocks(
    [line],
    'Cég',
    new Map([['s1', { email: null, phone: null, intro: '<p>Szia Forest!</p>', preferred: null }]]),
    new Date(),
    'Tisztelt Partnerünk!'
  )
  assert.equal(withSupplier[0].introSource, 'supplier')
  assert.equal(buildOrderTextBlocks([line], 'Cég')[0].introSource, 'default')
})
