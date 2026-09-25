/** Kliens-biztos típusok a Termékek Excel importhoz (nincs szerver import). */

export type AccessoryImportDecision = 'suggestion' | 'create'
/** Kulcs: `mfr:<összehajtott gyártónév>`. */
export type AccessoryImportDecisions = Record<string, AccessoryImportDecision>

export type AccessoryImportStatus = 'create' | 'update' | 'unchanged' | 'error'

export type AccessoryImportIssue = {
  level: 'error' | 'warning' | 'info'
  /** Oszlop felirat, vagy „Sor”. */
  where: string
  message: string
}

export type AccessoryImportItem = {
  rowNumber: number
  status: AccessoryImportStatus
  sku: string
  name: string
  manufacturerName: string
  changes: string[]
  issues: AccessoryImportIssue[]
}

export type AccessoryImportPending = {
  key: string
  raw: string
  rowCount: number
  suggestion: string | null
  choice: AccessoryImportDecision | null
}

export type AccessoryImportStats = {
  rows: number
  create: number
  update: number
  unchanged: number
  error: number
  /** Mentődik, de egy-egy hibás mező kimarad. */
  partial: number
  warning: number
}

export type AccessoryImportPreview = {
  stats: AccessoryImportStats
  /** A „Nem változik” sorok figyelmeztetés nélkül nincsenek benne (méretkorlát). */
  items: AccessoryImportItem[]
  pending: AccessoryImportPending[]
  notices: string[]
}

export type AccessoryImportFailure = { rowNumber: number; message: string }

export type AccessoryImportResult = {
  created: number
  updated: number
  unchanged: number
  skipped: number
  failed: AccessoryImportFailure[]
  createdManufacturers: number
  /** Sorok, amelyeknél maradt teendő (terv-hiba vagy mentési hiba). */
  problemCount: number
}

export function itemHasError(item: AccessoryImportItem): boolean {
  return item.status === 'error' || item.issues.some((i) => i.level === 'error')
}
