/** Shared labels / formatters for portal /saved and /orders lists */

export type PortalQuoteType = 'opti' | 'nettfront'

export type ChipColor =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'error'
  | 'info'
  | 'success'
  | 'warning'

export function portalTypeLabel(type?: PortalQuoteType | string | null): string {
  if (type === 'nettfront') return 'NETTFRONT'
  return 'Lapszabászat'
}

export function portalTypeChipColor(type?: PortalQuoteType | string | null): ChipColor {
  if (type === 'nettfront') return 'success'
  return 'primary'
}

export function formatPortalCurrency(amount: number): string {
  return (
    new Intl.NumberFormat('hu-HU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount) + ' Ft'
  )
}

export function formatPortalDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '—'
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('hu-HU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function getOrderStatusDisplay(status: string): { label: string; color: ChipColor } {
  const statusMap: Record<string, { label: string; color: ChipColor }> = {
    draft: { label: 'Beküldve', color: 'warning' },
    ordered: { label: 'Megrendelve', color: 'success' },
    in_production: { label: 'Gyártásban', color: 'info' },
    ready: { label: 'Gyártás kész', color: 'primary' },
    finished: { label: 'Átadva', color: 'success' },
    cancelled: { label: 'Törölve', color: 'error' },
    deleted: { label: 'Törölve', color: 'error' }
  }
  return statusMap[status] || { label: status, color: 'default' }
}

export function getPaymentStatusDisplay(
  paymentStatus: string | null | undefined
): { label: string; color: ChipColor } {
  if (!paymentStatus) return { label: '—', color: 'default' }
  const statusMap: Record<string, { label: string; color: ChipColor }> = {
    not_paid: { label: 'Nincs fizetve', color: 'error' },
    partial: { label: 'Részben fizetve', color: 'warning' },
    paid: { label: 'Kifizetve', color: 'success' }
  }
  return statusMap[paymentStatus] || { label: paymentStatus, color: 'default' }
}

export type StatusTimestamps = {
  submitted_at?: string | null
  ordered_at?: string | null
  in_production_at?: string | null
  ready_at?: string | null
  finished_at?: string | null
  cancelled_at?: string | null
}

export type TimelineEvent = {
  id: string
  at: string
  title: string
  detail?: string
  kind: 'status' | 'submit' | 'payment'
  chipLabel?: string
  chipColor?: ChipColor
}

/** Build chronological timeline (newest first) from portal submit + tenant status timestamps */
export function buildOrderStatusTimeline(args: {
  portalQuoteNumber: string
  companyQuoteNumber: string
  timestamps: StatusTimestamps
}): TimelineEvent[] {
  const { portalQuoteNumber, companyQuoteNumber, timestamps } = args
  const events: TimelineEvent[] = []

  if (timestamps.submitted_at) {
    events.push({
      id: 'submitted',
      at: timestamps.submitted_at,
      title: 'Beküldve a cégnek',
      detail: `Portál: ${portalQuoteNumber} → cég: ${companyQuoteNumber}`,
      kind: 'submit',
      chipLabel: 'Beküldve',
      chipColor: 'warning'
    })
  }

  if (timestamps.ordered_at) {
    events.push({
      id: 'ordered',
      at: timestamps.ordered_at,
      title: 'Megrendelve',
      detail: 'Státusz: Beküldve → Megrendelve',
      kind: 'status',
      chipLabel: 'Megrendelve',
      chipColor: 'success'
    })
  }

  if (timestamps.in_production_at) {
    events.push({
      id: 'in_production',
      at: timestamps.in_production_at,
      title: 'Gyártásban',
      detail: 'Státusz: Megrendelve → Gyártásban',
      kind: 'status',
      chipLabel: 'Gyártásban',
      chipColor: 'info'
    })
  }

  if (timestamps.ready_at) {
    events.push({
      id: 'ready',
      at: timestamps.ready_at,
      title: 'Gyártás kész',
      detail: 'Státusz → Gyártás kész',
      kind: 'status',
      chipLabel: 'Gyártás kész',
      chipColor: 'primary'
    })
  }

  if (timestamps.finished_at) {
    events.push({
      id: 'finished',
      at: timestamps.finished_at,
      title: 'Átadva',
      detail: 'Státusz → Átadva',
      kind: 'status',
      chipLabel: 'Átadva',
      chipColor: 'success'
    })
  }

  if (timestamps.cancelled_at) {
    events.push({
      id: 'cancelled',
      at: timestamps.cancelled_at,
      title: 'Törölve',
      detail: 'Státusz → Törölve',
      kind: 'status',
      chipLabel: 'Törölve',
      chipColor: 'error'
    })
  }

  return events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
}

/** Latest meaningful status change among timestamps (for table column) */
export function getLastStatusChangeAt(timestamps: StatusTimestamps): string | null {
  const candidates = [
    timestamps.cancelled_at,
    timestamps.finished_at,
    timestamps.ready_at,
    timestamps.in_production_at,
    timestamps.ordered_at,
    timestamps.submitted_at
  ].filter(Boolean) as string[]

  if (!candidates.length) return null

  return candidates.reduce((latest, cur) =>
    new Date(cur).getTime() > new Date(latest).getTime() ? cur : latest
  )
}
