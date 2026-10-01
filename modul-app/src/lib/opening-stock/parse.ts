import { z } from 'zod'

export const openingStockLineKindSchema = z.enum([
  'product',
  'sheet_material',
  'linear_material'
])

export type OpeningStockLineKind = z.infer<typeof openingStockLineKindSchema>

export const openingStockLineSchema = z.object({
  kind: openingStockLineKindSchema,
  id: z.string().uuid(),
  quantity: z.coerce.number().positive('Adj meg pozitív mennyiséget.')
})

export const openingStockFormSchema = z.object({
  warehouseId: z.string().uuid('Válaszd ki a raktárat.'),
  items: z
    .array(openingStockLineSchema)
    .min(1, 'Adj hozzá legalább egy tételt.')
})

export type OpeningStockFormInput = z.infer<typeof openingStockFormSchema>

export type OpeningStockSearchItem = {
  kind: OpeningStockLineKind
  id: string
  name: string
  sku: string
  /** Ledger egység a számláláshoz (db / tábla / fm). */
  unitShortform: string
  /** Ledger on-hand a kiválasztott raktáron. */
  onHand: number
  imageUrl?: string | null
}
