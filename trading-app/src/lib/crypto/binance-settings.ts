import { promises as fs } from "fs"
import path from "path"

export type BinanceDeskSettings = {
  autoTrade: boolean
  riskPercent: number
  leverageCap: number
  /** csak ezekre a coinokra nyit */
  symbols: ("SOL" | "DOGE")[]
  /** max élő nyitás / UTC nap (smoke nem számít) */
  maxDailyFires: number
  /** ha a napi equity esés eléri, auto OFF */
  maxDailyLossUsd: number
  /** UTC nap YYYY-MM-DD */
  dayKey: string | null
  /** nap eleji equity (balance+uPnL) */
  dayStartEquity: number | null
  firesToday: number
  /** auto kill miatt kikapcsolva */
  killedToday: boolean
  lastError: string | null
  lastErrorAt: string | null
  /** utolsó auto-nyitás kulcsa (dedup) */
  lastOpenedKey: string | null
  /** tracked live trades for partial management */
  liveTrades: BinanceLiveTrade[]
}

export type BinanceLiveTrade = {
  id: string
  signalKey: string
  symbol: string
  pair: string
  side: "LONG" | "SHORT"
  kind: string
  entry: number
  stop: number
  target: number
  tp1: number | null
  qty: number
  leverage: number
  riskUsd: number
  openedAt: string
  entryOrderId: number | null
  phase: "open" | "tp1_done" | "closed"
  note?: string
  smoke?: boolean
}

const DEFAULTS: BinanceDeskSettings = {
  autoTrade: false,
  riskPercent: 8,
  leverageCap: 20,
  symbols: ["SOL"],
  maxDailyFires: 5,
  maxDailyLossUsd: 25,
  dayKey: null,
  dayStartEquity: null,
  firesToday: 0,
  killedToday: false,
  lastError: null,
  lastErrorAt: null,
  lastOpenedKey: null,
  liveTrades: [],
}

function filePath() {
  return path.join(process.cwd(), ".data", "binance-desk.json")
}

export function utcDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10)
}

export async function loadBinanceSettings(): Promise<BinanceDeskSettings> {
  try {
    const raw = await fs.readFile(filePath(), "utf8")
    const parsed = JSON.parse(raw) as Partial<BinanceDeskSettings>
    return {
      ...DEFAULTS,
      ...parsed,
      symbols: parsed.symbols?.length ? parsed.symbols : DEFAULTS.symbols,
      liveTrades: parsed.liveTrades ?? [],
      maxDailyFires: parsed.maxDailyFires ?? DEFAULTS.maxDailyFires,
      maxDailyLossUsd: parsed.maxDailyLossUsd ?? DEFAULTS.maxDailyLossUsd,
      firesToday: parsed.firesToday ?? 0,
      killedToday: parsed.killedToday ?? false,
    }
  } catch {
    return { ...DEFAULTS, liveTrades: [] }
  }
}

export async function saveBinanceSettings(next: BinanceDeskSettings): Promise<void> {
  const dir = path.dirname(filePath())
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(filePath(), JSON.stringify(next, null, 2), "utf8")
}

export async function updateBinanceSettings(
  patch: Partial<BinanceDeskSettings>
): Promise<BinanceDeskSettings> {
  const cur = await loadBinanceSettings()
  const next: BinanceDeskSettings = {
    ...cur,
    ...patch,
    symbols: patch.symbols ?? cur.symbols,
    liveTrades: patch.liveTrades ?? cur.liveTrades,
  }
  await saveBinanceSettings(next)
  return next
}

export async function recordLastError(message: string): Promise<void> {
  await updateBinanceSettings({
    lastError: message,
    lastErrorAt: new Date().toISOString(),
  })
}

/** Új UTC nap → számlálók nullázása */
export async function rollDayIfNeeded(equityNow: number | null): Promise<BinanceDeskSettings> {
  const cur = await loadBinanceSettings()
  const today = utcDayKey()
  if (cur.dayKey === today) return cur
  return updateBinanceSettings({
    dayKey: today,
    dayStartEquity: equityNow,
    firesToday: 0,
    killedToday: false,
    // autoTrade szándékosan NEM kapcsoljuk vissza automatikusan
  })
}
