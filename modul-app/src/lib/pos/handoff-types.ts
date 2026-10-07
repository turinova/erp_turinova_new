import type { PosCartLine } from '@/lib/pos/session'

export type PosHandoffStatus =
  | 'open'
  | 'claimed'
  | 'completed'
  | 'cancelled'
  | 'expired'

export type PosHandoffListItem = {
  id: string
  code: string
  status: PosHandoffStatus
  warehouseId: string
  customerId: string | null
  createdByName: string | null
  lineCount: number
  totalGross: number
  createdAt: string
  expiresAt: string
}

export type PosHandoffDetail = PosHandoffListItem & {
  lines: PosCartLine[]
  note: string | null
}

export const HANDOFF_TTL_HOURS = 4
