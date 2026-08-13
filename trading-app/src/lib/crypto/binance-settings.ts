import { promises as fs } from "fs"
import path from "path"
import {
  BE_FEE_BUFFER_PCT,
  TRAIL_ACTIVATE_R,
  TRAIL_ATR_MULT,
} from "./stop-policy"
import { DEFAULT_TP1_FRAC } from "./paper-costs"

export type BinanceDeskSettings = {
  autoTrade: boolean
  riskPercent: number
  leverageCap: number
  /** csak ezekre a coinokra nyit */
  symbols: ("SOL" | "DOGE")[]
  /** max élő nyitás / UTC nap (smoke nem számít) */
  maxDailyFires: number
  /** ha a napi equity esés eléri (USD), auto OFF — a %-kal a szigorúbb nyer */
  maxDailyLossUsd: number
  /** napi equity esés % — pl. 3 = −3% dayStartEquity */
  maxDailyLossPct: number
  /**
   * Auto csak A+ setup: FVG / SWEEP + min RVOL.
   * false = ugyanazok a signalok, mint /crypto/signals paper.
   */
  autoOnlyGradeA: boolean
  /** A+ auto min rolling volume (1.0 = átlag) */
  autoMinRvol: number
  /**
   * Paper-szerű exit: tp1Frac @ tp1R → SL BE+fee → trail @ trailActivateR → runner @ target.
   * false = full size eredeti SL → full TP.
   */
  matchPaperExit: boolean
  /** ATR chandelier trail a runneren (TP1 után, MFE ≥ trailActivateR) */
  trailEnabled: boolean
  /** BE fee buffer (pl. 0.0008 = 0.08%) */
  beFeeBufferPct: number
  /** MFE (R) ahol a trail elindul */
  trailActivateR: number
  /** Chandelier: extreme − mult×ATR */
  trailAtrMult: number
  /** Partial scale-out R (1.25 survivor) */
  tp1R: number
  /** TP1 méret arány (0.35 = 35%) */
  tp1Frac: number
  /** Runner csak trail — nincs merev TP2 order */
  runnerOnlyTrail: boolean
  /** Min. perc ugyanarra a coinra új auto nyitás előtt */
  cooldownMinutes: number
  /** Utolsó auto-nyitás ideje coinonként (ISO) */
  lastOpenAtBySymbol: Partial<Record<"SOL" | "DOGE", string>>
  /** UTC nap YYYY-MM-DD */
  dayKey: string | null
  /** nap eleji equity (balance+uPnL) */
  dayStartEquity: number | null
  firesToday: number
  /** auto kill miatt kikapcsolva */
  killedToday: boolean
  lastError: string | null
  lastErrorAt: string | null
  /** utolsó auto-nyitás kulcsa (legacy) */
  lastOpenedKey: string | null
  /** mai / közelmúlt signalKey-k — dedup paperrel (date+symbol+kind) */
  openedSignalKeys: string[]
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
  /** aktuális protective SL (BE / trail ratchet) */
  stopLive: number
  target: number
  tp1: number | null
  qty: number
  leverage: number
  riskUsd: number
  openedAt: string
  entryOrderId: number | null
  phase: "open" | "tp1_done" | "trailing" | "closed"
  /** ATR a nyitáskor (trail fallback) */
  atrAtEntry: number | null
  /** BE+fee stop a TP1 után */
  beStop: number | null
  highWater: number
  lowWater: number
  note?: string
  smoke?: boolean
}

/**
 * Survivor mód — fee / overtrade / oversize ellen.
 * Risk 1–2%, lev ≤10×, A+ only, ritkább fire, későbbi trail.
 */
export const SURVIVOR_DESK_PATCH: Partial<BinanceDeskSettings> = {
  riskPercent: 2,
  leverageCap: 10,
  maxDailyFires: 8,
  maxDailyLossUsd: 15,
  maxDailyLossPct: 3,
  autoOnlyGradeA: true,
  autoMinRvol: 1.2,
  matchPaperExit: true,
  trailEnabled: true,
  beFeeBufferPct: BE_FEE_BUFFER_PCT,
  trailActivateR: TRAIL_ACTIVATE_R,
  trailAtrMult: TRAIL_ATR_MULT,
  tp1R: 1.25,
  tp1Frac: DEFAULT_TP1_FRAC,
  runnerOnlyTrail: false,
  cooldownMinutes: 90,
}

const DEFAULTS: BinanceDeskSettings = {
  autoTrade: false,
  riskPercent: 2,
  leverageCap: 10,
  symbols: ["SOL", "DOGE"],
  maxDailyFires: 8,
  maxDailyLossUsd: 15,
  maxDailyLossPct: 3,
  autoOnlyGradeA: true,
  autoMinRvol: 1.2,
  matchPaperExit: true,
  trailEnabled: true,
  beFeeBufferPct: BE_FEE_BUFFER_PCT,
  trailActivateR: TRAIL_ACTIVATE_R,
  trailAtrMult: TRAIL_ATR_MULT,
  tp1R: 1.25,
  tp1Frac: DEFAULT_TP1_FRAC,
  runnerOnlyTrail: false,
  cooldownMinutes: 90,
  lastOpenAtBySymbol: {},
  dayKey: null,
  dayStartEquity: null,
  firesToday: 0,
  killedToday: false,
  lastError: null,
  lastErrorAt: null,
  lastOpenedKey: null,
  openedSignalKeys: [],
  liveTrades: [],
}

/** serverless (Vercel): /tmp írható; lokálisan .data/ */
function filePath() {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join("/tmp", "binance-desk.json")
  }
  return path.join(process.cwd(), ".data", "binance-desk.json")
}

/** instance-szintű cache — cold start után default (auto OFF = biztonságos) */
let memoryCache: BinanceDeskSettings | null = null

function cloneSettings(s: BinanceDeskSettings): BinanceDeskSettings {
  return {
    ...s,
    symbols: [...s.symbols],
    openedSignalKeys: [...(s.openedSignalKeys ?? [])],
    lastOpenAtBySymbol: { ...(s.lastOpenAtBySymbol ?? {}) },
    liveTrades: s.liveTrades.map((t) => ({ ...t })),
  }
}

export function utcDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10)
}

function normalize(parsed: Partial<BinanceDeskSettings>): BinanceDeskSettings {
  const keys = [
    ...(parsed.openedSignalKeys ?? []),
    ...(parsed.lastOpenedKey ? [parsed.lastOpenedKey] : []),
  ]
  const openedSignalKeys = [...new Set(keys)].slice(0, 80)

  return {
    ...DEFAULTS,
    ...parsed,
    symbols: parsed.symbols?.length ? parsed.symbols : DEFAULTS.symbols,
    liveTrades: (parsed.liveTrades ?? []).map(normalizeLiveTrade),
    openedSignalKeys,
    lastOpenAtBySymbol: parsed.lastOpenAtBySymbol ?? DEFAULTS.lastOpenAtBySymbol,
    maxDailyFires: parsed.maxDailyFires ?? DEFAULTS.maxDailyFires,
    maxDailyLossUsd: parsed.maxDailyLossUsd ?? DEFAULTS.maxDailyLossUsd,
    maxDailyLossPct: parsed.maxDailyLossPct ?? DEFAULTS.maxDailyLossPct,
    autoOnlyGradeA: parsed.autoOnlyGradeA ?? DEFAULTS.autoOnlyGradeA,
    autoMinRvol: parsed.autoMinRvol ?? DEFAULTS.autoMinRvol,
    matchPaperExit: parsed.matchPaperExit ?? DEFAULTS.matchPaperExit,
    trailEnabled: parsed.trailEnabled ?? DEFAULTS.trailEnabled,
    beFeeBufferPct: parsed.beFeeBufferPct ?? DEFAULTS.beFeeBufferPct,
    trailActivateR: parsed.trailActivateR ?? DEFAULTS.trailActivateR,
    trailAtrMult: parsed.trailAtrMult ?? DEFAULTS.trailAtrMult,
    tp1R: parsed.tp1R ?? DEFAULTS.tp1R,
    tp1Frac: parsed.tp1Frac ?? DEFAULTS.tp1Frac,
    runnerOnlyTrail: parsed.runnerOnlyTrail ?? DEFAULTS.runnerOnlyTrail,
    cooldownMinutes: parsed.cooldownMinutes ?? DEFAULTS.cooldownMinutes,
    firesToday: parsed.firesToday ?? 0,
    killedToday: parsed.killedToday ?? false,
  }
}

function normalizeLiveTrade(t: Partial<BinanceLiveTrade> & { entry: number; stop: number }): BinanceLiveTrade {
  const entry = t.entry
  const stop = t.stop
  return {
    id: t.id ?? `${Date.now()}`,
    signalKey: t.signalKey ?? "",
    symbol: t.symbol ?? "",
    pair: t.pair ?? "",
    side: t.side ?? "LONG",
    kind: t.kind ?? "",
    entry,
    stop,
    stopLive: t.stopLive ?? stop,
    target: t.target ?? entry,
    tp1: t.tp1 ?? null,
    qty: t.qty ?? 0,
    leverage: t.leverage ?? 1,
    riskUsd: t.riskUsd ?? 0,
    openedAt: t.openedAt ?? new Date().toISOString(),
    entryOrderId: t.entryOrderId ?? null,
    phase: t.phase === "tp1_done" || t.phase === "trailing" || t.phase === "closed" ? t.phase : "open",
    atrAtEntry: t.atrAtEntry ?? null,
    beStop: t.beStop ?? null,
    highWater: t.highWater ?? entry,
    lowWater: t.lowWater ?? entry,
    note: t.note,
    smoke: t.smoke,
  }
}

export async function loadBinanceSettings(): Promise<BinanceDeskSettings> {
  if (memoryCache) return cloneSettings(memoryCache)
  try {
    const raw = await fs.readFile(filePath(), "utf8")
    const parsed = JSON.parse(raw) as Partial<BinanceDeskSettings>
    memoryCache = normalize(parsed)
    return cloneSettings(memoryCache)
  } catch {
    memoryCache = cloneSettings(DEFAULTS)
    return cloneSettings(memoryCache)
  }
}

export async function saveBinanceSettings(next: BinanceDeskSettings): Promise<void> {
  memoryCache = cloneSettings(next)
  try {
    const dir = path.dirname(filePath())
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(filePath(), JSON.stringify(next, null, 2), "utf8")
  } catch (e) {
    // Vercel read-only / ephemeral — memory cache elég a request élettartamára
    console.warn(
      "[binance-settings] write skipped:",
      e instanceof Error ? e.message : e
    )
  }
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
    openedSignalKeys: patch.openedSignalKeys ?? cur.openedSignalKeys,
    lastOpenAtBySymbol: patch.lastOpenAtBySymbol
      ? { ...cur.lastOpenAtBySymbol, ...patch.lastOpenAtBySymbol }
      : cur.lastOpenAtBySymbol,
  }
  await saveBinanceSettings(next)
  return next
}

/** Survivor preset felülírja a risk/exit/filter mezőket (autoTrade érintetlen) */
export async function applySurvivorDeskDefaults(): Promise<BinanceDeskSettings> {
  return updateBinanceSettings({ ...SURVIVOR_DESK_PATCH })
}

export async function recordLastError(message: string): Promise<void> {
  try {
    await updateBinanceSettings({
      lastError: message,
      lastErrorAt: new Date().toISOString(),
    })
  } catch (e) {
    console.warn(
      "[binance-settings] recordLastError failed:",
      e instanceof Error ? e.message : e
    )
  }
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
    openedSignalKeys: [],
    // autoTrade szándékosan NEM kapcsoljuk vissza automatikusan
  })
}

/** Napi kill limit USD: a szigorúbb a maxDailyLossUsd és a % közül */
export function dailyLossLimitUsd(settings: BinanceDeskSettings): number {
  const usd = Math.abs(settings.maxDailyLossUsd)
  const pct = Math.max(0, settings.maxDailyLossPct ?? 0)
  if (settings.dayStartEquity != null && settings.dayStartEquity > 1 && pct > 0) {
    const fromPct = settings.dayStartEquity * (pct / 100)
    return Math.min(usd, fromPct)
  }
  return usd
}

/** Memory cache ürítése (teszt / forced reload) */
export function clearBinanceSettingsCache(): void {
  memoryCache = null
}
