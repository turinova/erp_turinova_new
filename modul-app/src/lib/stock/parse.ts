import type { StatusBadgeTone } from '@/components/patterns/status-badge'
import type {
  StockMovementSource,
  StockMovementType
} from '@/lib/supabase/database.types'

export const MOVEMENT_TYPE_LABEL: Record<StockMovementType, string> = {
  in: 'Be',
  out: 'Ki'
}

export function movementTypeTone(type: StockMovementType): StatusBadgeTone {
  return type === 'in' ? 'success' : 'danger'
}

export const MOVEMENT_SOURCE_LABEL: Record<StockMovementSource, string> = {
  purchase_receipt: 'Beérkezés',
  sale_return: 'Visszáru',
  sale: 'Eladás',
  transfer: 'Áttárolás',
  adjustment: 'Korrekció'
}

export function movementSourceTone(
  source: StockMovementSource
): StatusBadgeTone {
  switch (source) {
    case 'purchase_receipt':
      return 'success'
    case 'sale_return':
      return 'warning'
    case 'sale':
      return 'danger'
    case 'transfer':
      return 'info'
    case 'adjustment':
      return 'neutral'
    default:
      return 'neutral'
  }
}
