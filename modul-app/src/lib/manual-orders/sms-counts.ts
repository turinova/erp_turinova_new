export type SmsCountItem = {
  id: string
  status: string
  name: string
  sku: string | null
  unitShortform: string
}

export type MoSmsCounts = {
  /** Most átvehető termékek (van megjött, még át nem adott része). */
  readyCount: number
  /** Még átvételre váró termékek (az átadottak nélkül). */
  totalCount: number
  /** Teljesen megjött vagy már átadott termékek. */
  arrivedCount: number
  /** Még nyitott / úton lévő termékek. */
  waitingCount: number
  /** Kész mondat az SMS-be (ékezet nélkül, a küldés úgyis ASCII-re fold-ol). */
  statusText: string
}

/**
 * Termékenként számol (részszállításnál a kettébontott tétel egy termék), és a már átadott
 * tételeket kihagyja a „hány van még hátra” számból — így 1 átadott + 1 most megjött = „minden átvehető”.
 * `arrivingIds`: a most megjöttnek jelölt tételek (még nyitott/úton státusszal érkeznek).
 */
export function moSmsCounts(items: SmsCountItem[], arrivingIds: Iterable<string> = []): MoSmsCounts {
  const arriving = new Set(arrivingIds)
  const groups = new Map<string, string[]>()
  for (const i of items) {
    if (i.status === 'torolve') continue
    const status = arriving.has(i.id) && (i.status === 'nyitott' || i.status === 'megrendelve') ? 'megerkezett' : i.status
    const key = `${(i.sku?.trim() || i.name.trim()).toLowerCase()}|${i.unitShortform.toLowerCase()}`
    groups.set(key, [...(groups.get(key) ?? []), status])
  }
  let readyCount = 0
  let totalCount = 0
  let arrivedCount = 0
  let waitingCount = 0
  for (const statuses of groups.values()) {
    const outstanding = statuses.some((s) => s !== 'atadva')
    if (outstanding) totalCount++
    if (statuses.includes('megerkezett')) readyCount++
    if (statuses.some((s) => s === 'nyitott' || s === 'megrendelve')) waitingCount++
    else arrivedCount++
  }
  const statusText =
    waitingCount === 0
      ? readyCount === 1 && totalCount === 1 && groups.size === 1
        ? 'a termek atveheto'
        : 'minden termek atveheto'
      : `${readyCount} termek atveheto, ${waitingCount} meg uton`
  return { readyCount, totalCount, arrivedCount, waitingCount, statusText }
}
