import { z } from 'zod'

export const PO_STATUSES = [
  'draft',
  'ordered',
  'partial',
  'received',
  'cancelled'
] as const
export type PurchaseOrderStatus = (typeof PO_STATUSES)[number]

export const PO_STATUS_LABEL: Record<PurchaseOrderStatus, string> = {
  draft: 'Vázlat',
  ordered: 'Elküldve',
  partial: 'Részben beérkezett',
  received: 'Beérkezett',
  cancelled: 'Törölve'
}

export function poStatusTone(
  status: PurchaseOrderStatus
): 'warning' | 'success' | 'info' | 'neutral' | 'danger' {
  if (status === 'draft') return 'warning'
  if (status === 'ordered') return 'success'
  if (status === 'partial') return 'info'
  if (status === 'received') return 'neutral'
  return 'danger'
}

export const PO_ORDER_KINDS = ['product', 'material'] as const
export type PurchaseOrderKind = (typeof PO_ORDER_KINDS)[number]

export const PO_ORDER_KIND_LABEL: Record<PurchaseOrderKind, string> = {
  product: 'Termék',
  material: 'Anyag'
}

export function poOrderKindTone(
  kind: PurchaseOrderKind
): 'neutral' | 'info' {
  return kind === 'material' ? 'info' : 'neutral'
}

export const PO_LINE_KINDS = [
  'accessory',
  'sheet_material',
  'linear_material'
] as const
export type PurchaseOrderLineKind = (typeof PO_LINE_KINDS)[number]

const emptyToNull = (v: string) => {
  const t = v.trim()
  return t === '' ? null : t
}

const qtySchema = z.coerce
  .number()
  .positive('A mennyiség legyen nagyobb nullánál.')
  .max(1_000_000)

const netPriceSchema = z.coerce
  .number()
  .int('Egész Ft legyen.')
  .min(0, 'Az ár nem lehet negatív.')

export const purchaseOrderAccessoryItemSchema = z.object({
  lineKind: z.literal('accessory'),
  accessoryId: z.string().uuid('Érvénytelen termék.'),
  sheetMaterialId: z.null().optional(),
  linearMaterialId: z.null().optional(),
  nameSnapshot: z.string().trim().min(1).max(200),
  skuSnapshot: z.string().trim().min(1).max(100),
  quantity: qtySchema,
  netPrice: netPriceSchema,
  taxRateId: z.string().uuid('Érvénytelen adónem.'),
  taxRatePercent: z.coerce.number().min(0).max(100),
  unitId: z.string().uuid('Érvénytelen egység.'),
  unitShortform: z.string().trim().min(1).max(20),
  pricePerAreaNet: z.null().optional(),
  areaOrLengthFactor: z.null().optional()
})

export const purchaseOrderSheetItemSchema = z.object({
  lineKind: z.literal('sheet_material'),
  accessoryId: z.null().optional(),
  sheetMaterialId: z.string().uuid('Érvénytelen táblás anyag.'),
  linearMaterialId: z.null().optional(),
  nameSnapshot: z.string().trim().min(1).max(200),
  skuSnapshot: z.string().trim().min(1).max(100),
  quantity: z.coerce
    .number()
    .int('Egész tábla legyen.')
    .positive('A mennyiség legyen nagyobb nullánál.')
    .max(1_000_000),
  netPrice: netPriceSchema,
  taxRateId: z.string().uuid('Érvénytelen adónem.'),
  taxRatePercent: z.coerce.number().min(0).max(100),
  unitId: z.null().optional(),
  unitShortform: z.literal('tábla'),
  pricePerAreaNet: z.coerce.number().int().min(0).nullable().optional(),
  areaOrLengthFactor: z.coerce.number().positive().nullable().optional()
})

export const purchaseOrderLinearItemSchema = z.object({
  lineKind: z.literal('linear_material'),
  accessoryId: z.null().optional(),
  sheetMaterialId: z.null().optional(),
  linearMaterialId: z.string().uuid('Érvénytelen szálas anyag.'),
  nameSnapshot: z.string().trim().min(1).max(200),
  skuSnapshot: z.string().trim().min(1).max(100),
  quantity: qtySchema,
  netPrice: netPriceSchema,
  taxRateId: z.string().uuid('Érvénytelen adónem.'),
  taxRatePercent: z.coerce.number().min(0).max(100),
  unitId: z.null().optional(),
  unitShortform: z.enum(['db', 'fm']),
  pricePerAreaNet: z.coerce.number().int().min(0).nullable().optional(),
  areaOrLengthFactor: z.coerce.number().positive().nullable().optional()
})

export const purchaseOrderItemSchema = z.discriminatedUnion('lineKind', [
  purchaseOrderAccessoryItemSchema,
  purchaseOrderSheetItemSchema,
  purchaseOrderLinearItemSchema
])

export const purchaseOrderFormSchema = z
  .object({
    orderKind: z.enum(PO_ORDER_KINDS),
    supplierId: z.string().uuid('Válassz beszállítót.'),
    warehouseId: z.string().uuid('Válassz célraktárat.'),
    expectedDate: z
      .string()
      .trim()
      .transform(emptyToNull)
      .refine(
        (v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v),
        'Érvénytelen dátum.'
      ),
    note: z.string().trim().max(2000).transform(emptyToNull),
    currency: z.enum(['HUF', 'EUR', 'USD']).default('HUF'),
    items: z
      .array(purchaseOrderItemSchema)
      .min(1, 'Legalább egy tétel kell.')
      .max(200)
  })
  .superRefine((data, ctx) => {
    for (let i = 0; i < data.items.length; i++) {
      const it = data.items[i]!
      const ok =
        data.orderKind === 'product'
          ? it.lineKind === 'accessory'
          : it.lineKind === 'sheet_material' ||
            it.lineKind === 'linear_material'
      if (!ok) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            data.orderKind === 'product'
              ? 'Termék rendelésre csak termék tehető.'
              : 'Anyag rendelésre csak táblás vagy szálas anyag tehető.',
          path: ['items', i, 'lineKind']
        })
      }
    }
  })

export type PurchaseOrderFormValues = z.infer<typeof purchaseOrderFormSchema>
export type PurchaseOrderItemInput = z.infer<typeof purchaseOrderItemSchema>

export type PurchaseOrderFormInput = {
  orderKind: PurchaseOrderKind
  supplierId: string
  warehouseId: string
  expectedDate: string
  note: string
  currency: 'HUF' | 'EUR' | 'USD'
  items: PurchaseOrderItemInput[]
}

/** m² a tábla méretéből */
export function sheetSquareMeters(lengthMm: number, widthMm: number): number {
  return (lengthMm * widthMm) / 1_000_000
}

/** Ft / tábla a Ft/m²-ből */
export function sheetUnitNetFromPerSqm(
  lengthMm: number,
  widthMm: number,
  priceNetPerSqm: number
): number {
  return Math.round(sheetSquareMeters(lengthMm, widthMm) * priceNetPerSqm)
}

/** Ft / szál a Ft/m-ből (fix hossz) */
export function linearUnitNetFromPerMeter(
  lengthMm: number,
  priceNetPerMeter: number
): number {
  return Math.round((lengthMm / 1000) * priceNetPerMeter)
}

/** Sor nettó / áfa / bruttó (HUF kerekítés). */
export function lineAmounts(
  quantity: number,
  netPrice: number,
  taxRatePercent: number
) {
  const net = Math.round(quantity * netPrice)
  const vat = Math.round((net * taxRatePercent) / 100)
  return { net, vat, gross: net + vat }
}

export function sumOrderAmounts(
  items: { quantity: number; netPrice: number; taxRatePercent: number }[]
) {
  return items.reduce(
    (acc, it) => {
      const line = lineAmounts(it.quantity, it.netPrice, it.taxRatePercent)
      acc.net += line.net
      acc.vat += line.vat
      acc.gross += line.gross
      return acc
    },
    { net: 0, vat: 0, gross: 0 }
  )
}

function mergeKey(it: PurchaseOrderItemInput): string {
  if (it.lineKind === 'accessory') return `a:${it.accessoryId}`
  if (it.lineKind === 'sheet_material') return `s:${it.sheetMaterialId}`
  return `l:${it.linearMaterialId}`
}

/** Duplikált tétel → qty összevonás (utolsó ár nyer). */
export function mergePurchaseOrderItems(
  items: PurchaseOrderItemInput[]
): PurchaseOrderItemInput[] {
  const map = new Map<string, PurchaseOrderItemInput>()
  for (const it of items) {
    const key = mergeKey(it)
    const prev = map.get(key)
    if (!prev) {
      map.set(key, { ...it })
      continue
    }
    map.set(key, {
      ...it,
      quantity: prev.quantity + it.quantity
    })
  }
  return Array.from(map.values())
}

/** @deprecated use mergePurchaseOrderItems */
export function mergeItemsByAccessory(
  items: PurchaseOrderItemInput[]
): PurchaseOrderItemInput[] {
  return mergePurchaseOrderItems(items)
}
