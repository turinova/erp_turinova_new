import { z } from 'zod'

import { EXPORT_FORMATS, type ExportFormat } from '@/lib/quotes/export/types'

export const equipmentFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'A név megadása kötelező.')
    .max(120, 'A név legfeljebb 120 karakter lehet.'),
  exportFormat: z.enum(
    EXPORT_FORMATS as unknown as [ExportFormat, ...ExportFormat[]],
    {
      errorMap: () => ({ message: 'Válassz export formátumot.' })
    }
  )
})

export type EquipmentFormValues = z.infer<typeof equipmentFormSchema>
