/**
 * A modul-app `/api/m/v1/*` válaszai (forrás: modul-app/src/lib/mobile/pulse.ts).
 * A számítás a szerveren van, hogy a mobil ugyanazt mutassa, mint a webes kezdőlap.
 */

export type Period = 'ma' | 'het' | 'honap'

export type MoneyCount = { gross: number; count: number }

export type RendeltSummary = {
  gross: number
  count: number
  compare: MoneyCount | null
  compareLabel: string
  compareDetail: string
}

export type AjanlatokSummary = { total: number; staff: MoneyCount; partner: MoneyCount }

export type SzabasSummary = { usedM: number; limitM: number; pct: number; orderCount: number }

export type ElmaradasSummary = { count: number; notStarted: number; meters: number; cutoffYmd: string }

export type MobilePulse = {
  generatedAt: string
  period: Period
  lapszabaszat: {
    rendelt: RendeltSummary
    ajanlatok: AjanlatokSummary
    szabas: SzabasSummary | null
    elmaradas: ElmaradasSummary
  } | null
}

export type SeriesPoint = {
  key: string
  label: string
  value: number | null
  compare: number | null
  highlight: boolean
}

export type RendeltDetail = {
  generatedAt: string
  period: Period
  summary: RendeltSummary
  series: SeriesPoint[]
  seriesKind: 'cumulative_hourly' | 'daily'
  split: { portal: MoneyCount; staff: MoneyCount }
  topMaterials: { name: string; boards: number; gross: number }[]
}

export type AjanlatokDetail = {
  generatedAt: string
  period: Period
  summary: AjanlatokSummary
  series: { key: string; label: string; staff: number | null; partner: number | null; highlight: boolean }[]
  topPartners: { name: string; count: number; gross: number }[]
}

export type SzabasDetail = {
  generatedAt: string
  today: SzabasSummary | null
  byMachine: { id: string; name: string; usedM: number; limitM: number; pct: number }[]
  nextDays: { ymd: string; label: string; usedM: number; limitM: number; orderCount: number }[]
}

export type ElmaradasDetail = {
  generatedAt: string
  summary: ElmaradasSummary
  rows: {
    id: string
    orderNumber: string
    customerName: string
    productionDate: string
    daysLate: number
    notStarted: boolean
    meters: number
  }[]
  webPath: string
}

export const PERIOD_OPTIONS: { id: Period; label: string }[] = [
  { id: 'ma', label: 'Ma' },
  { id: 'het', label: 'Hét' },
  { id: 'honap', label: 'Hónap' }
]
