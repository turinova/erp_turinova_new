import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildManualOrderView, type ManualViewItem } from './manual-view'

const it = (id: string, status: string, price: number | null = 1000, extra: Partial<ManualViewItem> = {}): ManualViewItem => ({
  id,
  name: `T${id}`,
  sku: null,
  qty: 1,
  unitShortform: 'db',
  unitPriceGross: price,
  status,
  arrivedAt: '2026-11-20T10:00:00Z',
  ...extra
})

test('előleg nagyobb, mint a kész rész: nem „kifizetve”, hanem megmaradó + később fizetendő', () => {
  const v = buildManualOrderView([it('1', 'megerkezett'), it('2', 'megrendelve', 3000)], [{ amount: 2000, voided: false }])
  assert.equal(v.dueNowGross, 0)
  assert.equal(v.creditAppliedGross, 1000)
  assert.equal(v.creditLeftGross, 1000)
  assert.equal(v.laterGross, 2000)
  assert.equal(v.statusLabel, 'Részben átvehető')
})

test('a befizetés először a már átvett tételeket fedezi', () => {
  const v = buildManualOrderView([it('1', 'atadva'), it('2', 'megerkezett')], [{ amount: 1000, voided: false }])
  assert.equal(v.dueNowGross, 1000)
  assert.equal(v.creditAppliedGross, null)
  assert.equal(v.handedItems?.length, 1)
})

test('sztornózott befizetés nem számít', () => {
  const v = buildManualOrderView([it('1', 'megerkezett')], [{ amount: 1000, voided: true }])
  assert.equal(v.dueNowGross, 1000)
})

test('ár nélküli kész tétel → átvételkor közöljük', () => {
  const v = buildManualOrderView([it('1', 'megerkezett', null)], [])
  assert.equal(v.dueNowGross, null)
  assert.equal(v.priceUnknown, true)
})

test('részszállítás: kettébontott tétel egy sorban, mennyiség összeadva', () => {
  const v = buildManualOrderView(
    [it('1', 'megerkezett', 500, { sku: 'X', qty: 3 }), it('2', 'megerkezett', 500, { sku: 'X', qty: 2 })],
    []
  )
  assert.equal(v.readyItems.length, 1)
  assert.equal(v.readyItems[0]!.qtyLabel, '5 db')
  assert.equal(v.dueNowGross, 2500)
})

test('lépések és állapot', () => {
  const open = buildManualOrderView([it('1', 'nyitott')], [])
  assert.equal(open.statusLabel, 'Rögzítettük')
  assert.equal(open.steps.find((s) => s.current)?.label, 'Megrendelve')
  const ordered = buildManualOrderView([it('1', 'megrendelve')], [])
  assert.equal(ordered.statusLabel, 'Megrendeltük')
  const done = buildManualOrderView([it('1', 'atadva')], [])
  assert.equal(done.statusTone, 'neutral')
  assert.equal(done.steps.length, 0)
  const cancelled = buildManualOrderView([it('1', 'torolve')], [])
  assert.equal(cancelled.statusLabel, 'Lezárva')
})

test('átvételi határidő az első megérkezéstől 14 nap', () => {
  const v = buildManualOrderView([it('1', 'megerkezett')], [])
  assert.equal(v.pickupUntil, 'december 4.')
})
