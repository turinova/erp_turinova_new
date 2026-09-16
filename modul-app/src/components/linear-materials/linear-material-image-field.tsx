'use client'

import { EntityImageField } from '@/components/media/entity-image-field'

type LinearMaterialImageFieldProps = {
  tenantId: string
  value: string | null
  onChange: (url: string | null) => void
  disabled?: boolean
  error?: string
}

/** Szálas anyag kép mező — médiaválasztóval. */
export function LinearMaterialImageField(props: LinearMaterialImageFieldProps) {
  return <EntityImageField {...props} uploadMode="legacy" showGrainHint />
}
