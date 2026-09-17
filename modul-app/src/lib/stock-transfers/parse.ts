import { z } from 'zod'

export const TRANSFER_STATUS_LABEL = {
  completed: 'Kész',
  cancelled: 'Törölve'
} as const

export type StockTransferStatus = keyof typeof TRANSFER_STATUS_LABEL

export function transferStatusTone(
  status: StockTransferStatus
): 'success' | 'neutral' | 'danger' {
  if (status === 'completed') return 'success'
  if (status === 'cancelled') return 'danger'
  return 'neutral'
}

export const stockTransferItemSchema = z.object({
  accessoryId: z.string().uuid('Érvénytelen termék.'),
  quantity: z
    .number({ invalid_type_error: 'Adj meg mennyiséget.' })
    .positive('A mennyiség legyen pozitív.')
})

export const stockTransferFormSchema = z
  .object({
    fromWarehouseId: z.string().uuid('Válaszd ki a forrásraktárat.'),
    toWarehouseId: z.string().uuid('Válaszd ki a célraktárat.'),
    note: z
      .string()
      .trim()
      .max(500, 'A megjegyzés legfeljebb 500 karakter.')
      .nullable()
      .optional(),
    items: z
      .array(stockTransferItemSchema)
      .min(1, 'Adj hozzá legalább egy terméket.')
  })
  .refine((v) => v.fromWarehouseId !== v.toWarehouseId, {
    message: 'A forrás- és célraktár nem lehet ugyanaz.',
    path: ['toWarehouseId']
  })

export type StockTransferFormInput = z.infer<typeof stockTransferFormSchema>
