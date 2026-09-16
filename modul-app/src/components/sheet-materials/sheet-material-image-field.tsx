'use client'

import { EntityImageField } from '@/components/media/entity-image-field'

type SheetMaterialImageFieldProps = {
  tenantId: string
  value: string | null
  onChange: (url: string | null) => void
  disabled?: boolean
  error?: string
  showGrainHint?: boolean
}

/** Táblás / szálas kép mező — médiaválasztóval. */
export function SheetMaterialImageField(props: SheetMaterialImageFieldProps) {
  return <EntityImageField {...props} uploadMode="legacy" />
}
