/**
 * Bolt Excel import terheléses teszt — adatbázis nélkül (hamis kontextus).
 * Futtatás: npx tsx scripts/bench-shop-import.ts [termékszám]
 *
 * 1) export → visszaolvasás → terv: 0 változás (idempotens kör)
 * 2) N cella módosítása → pontosan N írás
 * 3) ismeretlen kategória / érték → döntési lista
 */
import { mapAccessoryWebFields } from '@/lib/accessories/web-shop'
import {
  foldKey,
  type ShopXAttribute,
  type ShopXCategory,
  type ShopXContext,
  type ShopXMedia,
  type ShopXProduct,
  type ShopXRelated
} from '@/lib/webshop/excel/context'
import { buildShopImportPlan } from '@/lib/webshop/excel/plan'
import { readShopWorkbook } from '@/lib/webshop/excel/read'
import { buildShopWorkbook } from '@/lib/webshop/excel/write'

const N = Number(process.argv[2] ?? 10000)
const uuid = (p: number, i: number) =>
  `${p.toString(16).padStart(8, '0')}-0000-4000-8000-${i.toString(16).padStart(12, '0')}`

function fakeContext(): ShopXContext {
  const categories: ShopXCategory[] = []
  for (let i = 0; i < 40; i++) {
    const parent = i < 8 ? null : categories[i % 8]!
    categories.push({
      id: uuid(1, i),
      name: `Kategória ${i}`,
      parentId: parent?.id ?? null,
      active: true,
      googleTaxonomyId: null,
      measureImageUrl: null,
      template: [],
      path: parent ? `${parent.name} > Kategória ${i}` : `Kategória ${i}`
    })
  }
  const attributes: ShopXAttribute[] = []
  for (let a = 0; a < 12; a++) {
    const list = a % 2 === 0
    attributes.push({
      id: uuid(2, a),
      name: `Jellemző ${a}`,
      code: `attr_${a}`,
      valueType: list ? 'list' : 'number',
      unit: list ? null : 'mm',
      allowMultiple: a === 0,
      isVariantAxis: a < 2,
      active: true,
      sortOrder: a,
      values: list
        ? Array.from({ length: 30 }, (_, v) => ({ id: uuid(3, a * 100 + v), label: `Érték ${a}-${v}`, active: true }))
        : [],
      usage: N
    })
  }
  const valueOwner = new Map<string, ShopXAttribute>()
  for (const a of attributes) for (const v of a.values) valueOwner.set(v.id, a)

  const media: ShopXMedia[] = Array.from({ length: 2000 }, (_, i) => ({
    id: uuid(4, i),
    filename: `F${String(i).padStart(6, '0')}.${i % 10 === 0 ? 'pdf' : 'jpg'}`,
    url: `https://cdn.test/t/${i}.${i % 10 === 0 ? 'pdf' : 'jpg'}`,
    mime: i % 10 === 0 ? 'application/pdf' : 'image/jpeg'
  }))

  const products: ShopXProduct[] = []
  const related = new Map<string, ShopXRelated[]>()
  const documents: ShopXContext['documents'] = new Map()
  for (let i = 0; i < N; i++) {
    const id = uuid(5, i)
    const cat = categories[8 + (i % 32)]!
    const img = media[(i % 1800) + 1]!
    products.push({
      id,
      sku: `SKU-${i}`,
      name: `Termék ${i}`,
      barcode: null,
      imageUrl: img.url,
      priceNet: 1000 + i,
      priceGross: Math.round((1000 + i) * 1.27),
      vatPercent: 27,
      active: true,
      manufacturerName: null,
      web: mapAccessoryWebFields({
        sellable_web: i % 3 !== 0,
        web_slug: `termek-${i}`,
        web_title: `Webes termék ${i}`,
        web_description_short: 'Rövid leírás',
        web_brand: 'Márka',
        web_group_id: i % 5 === 0 ? `CSOP-${Math.floor(i / 10)}` : null,
        web_gallery: [media[((i + 7) % 1800) + 1]!.url],
        web_faq: i % 4 === 0 ? [{ q: 'Kérdés?', a: 'Válasz.' }] : []
      }),
      categoryId: cat.id,
      webUpdatedAt: null,
      valueIds: [attributes[0]!.values[i % 30]!.id, attributes[2]!.values[(i * 7) % 30]!.id],
      inputs: [{ attributeId: attributes[1]!.id, valueNum: (i % 50) + 1, valueMax: null, valueBool: null }]
    } as ShopXProduct)
    if (i > 0 && i % 2 === 0) related.set(id, [{ relatedId: uuid(5, i - 1), kind: 'accessory', sortOrder: 0 }])
    if (i % 10 === 0) {
      documents.set(id, [{ mediaId: media[0]!.id, kind: 'manual', title: 'Útmutató', language: 'hu', sortOrder: 0 }])
    }
  }

  return {
    categories,
    categoryById: new Map(categories.map((c) => [c.id, c])),
    attributes,
    attributeById: new Map(attributes.map((a) => [a.id, a])),
    valueOwner,
    products,
    bySku: new Map(products.map((p) => [foldKey(p.sku), p])),
    byId: new Map(products.map((p) => [p.id, p])),
    deletedSkus: new Set(),
    related,
    documents,
    mediaByFilename: new Map(media.map((m) => [m.filename.toLowerCase(), m])),
    mediaById: new Map(media.map((m) => [m.id, m])),
    mediaByUrl: new Map(media.map((m) => [m.url, m])),
    groups: new Map(),
    mappings: new Map(),
    bulkReady: true
  }
}

async function time<T>(label: string, fn: () => Promise<T> | T): Promise<T> {
  const t = performance.now()
  const out = await fn()
  console.log(`${label.padEnd(34)} ${Math.round(performance.now() - t)} ms`)
  return out
}

function assert(ok: boolean, msg: string) {
  if (!ok) {
    console.error(`HIBA: ${msg}`)
    process.exitCode = 1
  } else console.log(`OK   ${msg}`)
}

async function main() {
  const ctx = fakeContext()
  console.log(`Termékek: ${N}`)

  const buffer = await time('export (full + minden lap)', () =>
    buildShopWorkbook(ctx, ctx.products, 'full', {
      sheets: ['specs', 'faq', 'related', 'documents', 'groups', 'categories', 'attributes']
    })
  )
  console.log(`fájlméret                          ${(buffer.length / 1024 / 1024).toFixed(1)} MB`)

  const read = await time('visszaolvasás', () => readShopWorkbook(buffer, 'bolt.xlsx'))
  if (!read.ok) throw new Error(read.message)

  const plan0 = await time('terv (változatlan)', () => buildShopImportPlan(ctx, read.workbook, {}))
  const errors0 = plan0.preview.problems
  if (errors0.length) console.log(errors0.slice(0, 5))
  assert(plan0.writes.length === 0, `változatlan kör: 0 írás (kapott ${plan0.writes.length})`)
  assert(errors0.length === 0, `változatlan kör: 0 probléma (kapott ${errors0.length})`)
  assert(plan0.creations.length === 0, `változatlan kör: 0 létrehozás (kapott ${plan0.creations.length})`)

  const wb = read.workbook
  const rows = wb.products!.rows
  const EDIT = Math.min(1000, rows.length)
  for (let i = 0; i < EDIT; i++) rows[i]!.cells.shortDescription = `Új rövid leírás ${i}`
  const plan1 = await time(`terv (${EDIT} leírás módosítva)`, () => buildShopImportPlan(ctx, wb, {}))
  assert(plan1.writes.length === EDIT, `${EDIT} módosítás → ${EDIT} írás (kapott ${plan1.writes.length})`)

  rows[0]!.cells.category = 'Nem létező > Új alkategória'
  const specRow = wb.specs?.rows.find((r) => r.cells.attribute === 'Jellemző 2')
  if (specRow) specRow.cells.value = 'Teljesen új érték'
  wb.specs?.rows.push({ rowNumber: 99999, cells: { sku: 'SKU-3', attribute: 'Új jellemző', value: '12 mm' } })
  const plan2 = await time('terv (ismeretlen kat. + érték)', () => buildShopImportPlan(ctx, wb, {}))
  const pending = plan2.preview.pending
  console.log(`döntésre vár: ${pending.map((p) => `${p.kind}:${p.raw} [${p.key}]`).join(', ')}`)
  for (const kind of ['category', 'value', 'attribute'] as const) {
    assert(pending.some((p) => p.kind === kind), `ismeretlen ${kind} → döntés`)
  }

  const decided = Object.fromEntries(pending.map((p) => [p.key, 'create' as const]))
  const plan3 = await time('terv (döntés: létrehozás)', () => buildShopImportPlan(ctx, wb, decided))
  const open3 = plan3.preview.pending.filter((p) => p.choice == null)
  assert(open3.length === 0, `döntés után nincs eldöntetlen tétel (kapott ${open3.length})`)
  assert(
    plan3.creations.some((c) => c.kind === 'category'),
    `létrehozások: ${plan3.creations.map((c) => c.kind).join(', ')}`
  )

  const snapBuf = await time('mentés-fájl (pillanatkép)', () => buildShopWorkbook(ctx, ctx.products, 'snapshot'))
  const snap = await readShopWorkbook(snapBuf, 'mentes.xlsx')
  if (!snap.ok) throw new Error(snap.message)
  assert(snap.workbook.snapshot, 'mentés-fájl pillanatkép módban olvasódik')
  const plan4 = await time('terv (visszaállítás, változatlan)', () => buildShopImportPlan(ctx, snap.workbook, {}))
  assert(plan4.writes.length === 0, `visszaállítás változatlan adatra: 0 írás (kapott ${plan4.writes.length})`)
  assert(plan4.preview.problems.length === 0, `visszaállítás: 0 probléma (kapott ${plan4.preview.problems.length})`)

  const mem = process.memoryUsage()
  console.log(`memória (heap)                     ${Math.round(mem.heapUsed / 1024 / 1024)} MB`)
}

void main()
