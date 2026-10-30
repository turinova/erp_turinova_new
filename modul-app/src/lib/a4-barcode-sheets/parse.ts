import { z } from 'zod'

export const a4SheetCellSchema = z.object({
  row: z.number().int().min(0).max(11),
  col: z.number().int().min(0).max(7),
  accessoryId: z.string().uuid().nullable(),
  barcodeValue: z.string().trim().min(1).max(128),
  barcodeSource: z.enum(['auto', 'supplier', 'internal']),
  nameSnap: z.string().max(44).optional().default(''),
  skuSnap: z.string().max(80).optional().default(''),
  priceGross: z.number().finite().nullable().optional(),
  unitSnap: z.string().trim().max(12).optional().default('db'),
  showName: z.boolean().default(true),
  showSku: z.boolean().default(false),
  showPrice: z.boolean().default(true),
  showBarcode: z.boolean().default(true)
})

export const a4SheetFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Add meg a lap nevét.')
    .max(120, 'A név legfeljebb 120 karakter.'),
  cols: z.number().int().min(1).max(8),
  rows: z.number().int().min(1).max(12),
  marginMm: z.number().min(0).max(25),
  showName: z.boolean(),
  showSku: z.boolean(),
  showPrice: z.boolean(),
  cells: z.array(a4SheetCellSchema).max(96)
})

export type A4SheetFormInput = z.infer<typeof a4SheetFormSchema>
