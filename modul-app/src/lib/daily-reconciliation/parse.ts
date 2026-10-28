import { z } from 'zod'

export const RECON_TENDERS = ['cash', 'card', 'transfer'] as const
export type ReconTender = (typeof RECON_TENDERS)[number]

export const RECON_TENDER_LABEL: Record<ReconTender, string> = {
  cash: 'Készpénz',
  card: 'Kártya',
  transfer: 'Utalás'
}

/** Küszöbök — OK nap döntéséhez. */
export const RECON_THRESHOLDS = {
  cashAbs: 2000,
  cardAbs: 1000,
  cardPct: 0.005,
  transferAbs: 5000
} as const

/**
 * Havi bónusz (Kecskemét kisbolt).
 * ≥90% / ≥95% pontosság + min. kitöltött nap.
 * Bolti ≈ műszaki; üzletvezető magasabb.
 */
export const RECON_BONUS = {
  minFilledDays: 15,
  staff90: 20_000,
  staff95: 28_000,
  manager90: 30_000,
  manager95: 40_000
} as const

/** 0 = nincs sáv, 90 / 95 = elért küszöb. */
export type ReconBonusTier = 0 | 90 | 95

export function resolveReconBonusTier(
  accuracyPct: number | null,
  filledCount: number
): ReconBonusTier {
  if (accuracyPct == null || filledCount < RECON_BONUS.minFilledDays) return 0
  if (accuracyPct >= 95) return 95
  if (accuracyPct >= 90) return 90
  return 0
}

export function reconBonusStaffFt(tier: ReconBonusTier): number {
  if (tier === 95) return RECON_BONUS.staff95
  if (tier === 90) return RECON_BONUS.staff90
  return 0
}

export function reconBonusManagerFt(tier: ReconBonusTier): number {
  if (tier === 95) return RECON_BONUS.manager95
  if (tier === 90) return RECON_BONUS.manager90
  return 0
}

export type DayChipStatus = 'empty' | 'ok' | 'variance' | 'partial'

export type TenderAmounts = {
  cash: number
  card: number
  transfer: number
}

export const saveDailyReconciliationSchema = z.object({
  businessDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Érvénytelen dátum.'),
  storeCash: z.number().int().min(0).nullable(),
  storeCard: z.number().int().min(0).nullable(),
  storeTransfer: z.number().int().min(0).nullable(),
  note: z.string().trim().max(500).nullable(),
  systemCash: z.number().int().min(0),
  systemCard: z.number().int().min(0),
  systemTransfer: z.number().int().min(0)
})

export type SaveDailyReconciliationInput = z.infer<
  typeof saveDailyReconciliationSchema
>

export function tenderWithinThreshold(
  tender: ReconTender,
  system: number,
  store: number
): boolean {
  const delta = Math.abs(store - system)
  if (tender === 'cash') return delta <= RECON_THRESHOLDS.cashAbs
  if (tender === 'transfer') return delta <= RECON_THRESHOLDS.transferAbs
  const pctLimit = system * RECON_THRESHOLDS.cardPct
  return delta <= Math.max(RECON_THRESHOLDS.cardAbs, pctLimit)
}

export function computeDayStatus(
  system: TenderAmounts,
  store: {
    cash: number | null
    card: number | null
    transfer: number | null
  }
): DayChipStatus {
  const filled = RECON_TENDERS.filter((t) => store[t] != null)
  if (filled.length === 0) return 'empty'
  if (filled.length < RECON_TENDERS.length) return 'partial'

  const allOk = RECON_TENDERS.every((t) =>
    tenderWithinThreshold(t, system[t], store[t] as number)
  )
  return allOk ? 'ok' : 'variance'
}

export function formatReconMoney(n: number): string {
  return `${new Intl.NumberFormat('hu-HU').format(n)} Ft`
}

/** Europe/Budapest naptári nap YYYY-MM-DD. */
export function toBudapestDate(iso: string | Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Budapest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(typeof iso === 'string' ? new Date(iso) : iso)
}

export function todayBudapest(): string {
  return toBudapestDate(new Date())
}

export function parseYearMonth(ym: string): { year: number; month: number } {
  const m = /^(\d{4})-(\d{2})$/.exec(ym)
  if (!m) {
    const t = todayBudapest()
    return {
      year: Number(t.slice(0, 4)),
      month: Number(t.slice(5, 7))
    }
  }
  return { year: Number(m[1]), month: Number(m[2]) }
}

export function currentYearMonth(): string {
  return todayBudapest().slice(0, 7)
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

/** Bolt munkanapok: hétfő–szombat. */
export function listWorkdaysInMonth(year: number, month: number): string[] {
  const last = new Date(year, month, 0).getDate()
  const out: string[] = []
  for (let d = 1; d <= last; d++) {
    const dow = new Date(year, month - 1, d).getDay()
    if (dow === 0) continue
    out.push(`${year}-${pad2(month)}-${pad2(d)}`)
  }
  return out
}

export function shiftYearMonth(ym: string, delta: number): string {
  const { year, month } = parseYearMonth(ym)
  const d = new Date(year, month - 1 + delta, 1)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}

export function yearMonthLabel(ym: string): string {
  const { year, month } = parseYearMonth(ym)
  const label = new Date(year, month - 1, 1).toLocaleDateString('hu-HU', {
    year: 'numeric',
    month: 'long'
  })
  return label
}

export function dayLabelHu(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!m) return isoDate
  return new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3])
  ).toLocaleDateString('hu-HU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  })
}
