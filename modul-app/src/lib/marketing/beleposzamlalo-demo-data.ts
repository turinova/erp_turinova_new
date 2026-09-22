/**
 * Belépőszámláló marketing demo adat — egyetlen koherens hónap.
 *
 * A mintázat a `docs/footcounter-pi.md` seedet követi: H–P ~150–220 belépő,
 * szerda / csütörtök csúcs, szombat gyengébb (8–12 nyitva), vasárnap zárva.
 * Minden aggregátum ebből számolódik, hogy az oldalon látható számok
 * (hero, heatmap, havi chart, szezon) egymással kereken egyezzenek.
 */

/** Nyitvatartás: hétköznap 8–17, szombat 8–12 (a main-app footcounter logikája). */
export const OPEN_HOURS = { start: 8, end: 17 } as const
export const SATURDAY_CLOSE_HOUR = 12

export const HOUR_LABELS: string[] = Array.from(
  { length: OPEN_HOURS.end - OPEN_HOURS.start + 1 },
  (_, i) => String(OPEN_HOURS.start + i)
)

export const WEEKDAY_LABELS = [
  'Hétfő',
  'Kedd',
  'Szerda',
  'Csütörtök',
  'Péntek',
  'Szombat',
  'Vasárnap'
] as const

export const WEEKDAY_SHORT = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'] as const

export type DemoWeather = 'dry' | 'rain' | 'wind' | 'heat'

export type DemoDay = {
  /** Naptári nap (1–31). */
  day: number
  /** 0 = hétfő … 6 = vasárnap. */
  weekday: number
  inCount: number
  outCount: number
  weather: DemoWeather
  closed?: boolean
  /** Akciós / kampánynap — a copy külön hivatkozik rá. */
  campaign?: boolean
}

export const DEMO_MONTH = {
  year: 2026,
  month: 3,
  label: '2026. március',
  shortLabel: 'márc.'
} as const

/** 2026. március 1. vasárnap → a hét indexek ebből jönnek. */
const MARCH_2026_FIRST_WEEKDAY = 6

function weekdayOf(day: number): number {
  return (MARCH_2026_FIRST_WEEKDAY + day - 1) % 7
}

type DayInput = {
  day: number
  in: number
  weather?: DemoWeather
  campaign?: boolean
}

/** Kilépő ≈ belépő, kis maradékkal (aki még bent van záráskor / átfedés). */
function outFor(inCount: number): number {
  if (inCount === 0) return 0
  return Math.round(inCount * 0.94)
}

const DAY_INPUTS: DayInput[] = [
  { day: 2, in: 168 },
  { day: 3, in: 181 },
  { day: 4, in: 206 },
  { day: 5, in: 214 },
  { day: 6, in: 197 },
  { day: 7, in: 132 },
  { day: 9, in: 159, weather: 'rain' },
  { day: 10, in: 168, weather: 'wind' },
  { day: 11, in: 198 },
  { day: 12, in: 268, campaign: true },
  { day: 13, in: 203 },
  { day: 14, in: 139 },
  { day: 16, in: 141, weather: 'rain' },
  { day: 17, in: 166, weather: 'rain' },
  { day: 18, in: 193 },
  { day: 19, in: 209 },
  { day: 20, in: 188, weather: 'rain' },
  { day: 21, in: 128 },
  { day: 23, in: 172 },
  { day: 24, in: 179 },
  { day: 25, in: 211 },
  { day: 26, in: 224 },
  { day: 27, in: 179, weather: 'wind' },
  { day: 28, in: 135 },
  { day: 30, in: 165 },
  { day: 31, in: 170, weather: 'wind' }
]

const DAY_BY_NUMBER = new Map(DAY_INPUTS.map((d) => [d.day, d]))

export const DEMO_DAYS: DemoDay[] = Array.from({ length: 31 }, (_, i) => {
  const day = i + 1
  const weekday = weekdayOf(day)
  const input = DAY_BY_NUMBER.get(day)

  if (!input) {
    return { day, weekday, inCount: 0, outCount: 0, weather: 'dry', closed: true }
  }

  return {
    day,
    weekday,
    inCount: input.in,
    outCount: outFor(input.in),
    weather: input.weather ?? 'dry',
    campaign: input.campaign
  }
})

export const OPEN_DAYS = DEMO_DAYS.filter((d) => !d.closed)

export const MONTH_TOTAL_IN = OPEN_DAYS.reduce((sum, d) => sum + d.inCount, 0)
export const MONTH_TOTAL_OUT = OPEN_DAYS.reduce((sum, d) => sum + d.outCount, 0)
export const MONTH_AVG_IN = Math.round(MONTH_TOTAL_IN / OPEN_DAYS.length)
export const MONTH_MAX_IN = Math.max(...OPEN_DAYS.map((d) => d.inCount))

export const PEAK_DAY: DemoDay = OPEN_DAYS.reduce((best, d) =>
  d.inCount > best.inCount ? d : best
)

export const WEAKEST_DAY: DemoDay = OPEN_DAYS.reduce((worst, d) =>
  d.inCount < worst.inCount ? d : worst
)

export const CAMPAIGN_DAY = DEMO_DAYS.find((d) => d.campaign)

/** Ugyanaz a hétköznap, a kampánynap előtt — a kampány hatásának bázisa. */
export const CAMPAIGN_BASELINE_DAY = CAMPAIGN_DAY
  ? OPEN_DAYS.find(
      (d) => d.weekday === CAMPAIGN_DAY.weekday && d.day < CAMPAIGN_DAY.day
    )
  : undefined

export type WeekdayProfileRow = {
  weekday: number
  label: string
  short: string
  avgIn: number
  sampleDays: number
  closed: boolean
}

export const WEEKDAY_PROFILE: WeekdayProfileRow[] = WEEKDAY_LABELS.map(
  (label, weekday) => {
    const days = OPEN_DAYS.filter((d) => d.weekday === weekday)
    const sum = days.reduce((s, d) => s + d.inCount, 0)
    return {
      weekday,
      label,
      short: WEEKDAY_SHORT[weekday] ?? label,
      avgIn: days.length > 0 ? Math.round(sum / days.length) : 0,
      sampleDays: days.length,
      closed: days.length === 0
    }
  }
)

export const WEEKDAY_MAX_AVG = Math.max(
  ...WEEKDAY_PROFILE.map((r) => r.avgIn)
)

export const BUSIEST_WEEKDAY: WeekdayProfileRow = WEEKDAY_PROFILE.reduce(
  (best, r) => (r.avgIn > best.avgIn ? r : best)
)

/**
 * Napon belüli alak (8–17). Két csúcs: délelőtti bevásárlás és munka utáni
 * sáv. Szombaton a délelőtt sűrűbb, mert 12-kor zár.
 */
const WEEKDAY_HOUR_SHAPE = [
  0.03, 0.07, 0.13, 0.16, 0.1, 0.08, 0.07, 0.1, 0.14, 0.12
]
const SATURDAY_HOUR_SHAPE = [0.18, 0.27, 0.31, 0.24, 0, 0, 0, 0, 0, 0]

export type HeatmapCell = {
  hour: number
  value: number
  closed: boolean
}

export type HeatmapRow = {
  weekday: number
  label: string
  short: string
  cells: HeatmapCell[]
  total: number
  closed: boolean
}

/** Hét × óra mátrix: átlagos belépő óránként, a heti profilra skálázva. */
export const HEATMAP_ROWS: HeatmapRow[] = WEEKDAY_PROFILE.map((row) => {
  const isSaturday = row.weekday === 5
  const shape = isSaturday ? SATURDAY_HOUR_SHAPE : WEEKDAY_HOUR_SHAPE

  const cells: HeatmapCell[] = HOUR_LABELS.map((_, i) => {
    const hour = OPEN_HOURS.start + i
    const closed = row.closed || (isSaturday && hour >= SATURDAY_CLOSE_HOUR)
    return {
      hour,
      value: closed ? 0 : Math.round(row.avgIn * (shape[i] ?? 0)),
      closed
    }
  })

  return {
    weekday: row.weekday,
    label: row.label,
    short: row.short,
    cells,
    total: cells.reduce((s, c) => s + c.value, 0),
    closed: row.closed
  }
})

export const HEATMAP_MAX = Math.max(
  ...HEATMAP_ROWS.flatMap((r) => r.cells.map((c) => c.value))
)

export const HEATMAP_PEAK = (() => {
  let peak: { weekday: number; hour: number; value: number; label: string } = {
    weekday: 0,
    hour: OPEN_HOURS.start,
    value: 0,
    label: ''
  }
  for (const row of HEATMAP_ROWS) {
    for (const cell of row.cells) {
      if (cell.value > peak.value) {
        peak = {
          weekday: row.weekday,
          hour: cell.hour,
          value: cell.value,
          label: row.label
        }
      }
    }
  }
  return peak
})()

/** „Ma" nézet: 2026. március 19., csütörtök — a havi sorozat egyik napja. */
const TODAY_SOURCE_DAY = 19

export const TODAY = (() => {
  const source = DEMO_DAYS.find((d) => d.day === TODAY_SOURCE_DAY)
  const inCount = source?.inCount ?? 0
  const outCount = source?.outCount ?? 0
  const weekday = source?.weekday ?? 0
  return {
    day: TODAY_SOURCE_DAY,
    weekday,
    label: `${DEMO_MONTH.year}. ${DEMO_MONTH.shortLabel} ${TODAY_SOURCE_DAY}., ${
      WEEKDAY_LABELS[weekday]?.toLowerCase() ?? ''
    }`,
    inCount,
    outCount,
    occupancy: Math.max(0, inCount - outCount)
  }
})()

export type TodayHour = {
  hour: number
  inCount: number
  outCount: number
  /** Még nem jött el ez az óra — a chartban üres helyőrző. */
  pending: boolean
  /** Éppen tart ez az óra — részleges érték. */
  running: boolean
}

/**
 * A nap még tart: 16:24 van, a 17 órás sáv üres, a 16 órás részleges.
 * A teljes napi be / ki (`TODAY`) így is kijön, ha minden óra lezárul —
 * a záráskori kilépő-csúcs a 17 órás sávban van.
 */
export const LIVE_CLOCK_LABEL = '16:24'
export const RUNNING_HOUR = 16
const FULL_DAY_IN = [6, 14, 27, 34, 22, 18, 16, 21, 29, 22]
const FULL_DAY_OUT = [1, 9, 21, 30, 24, 17, 15, 19, 24, 36]
/** A futó óra eddigi része (16:00–16:24). */
const RUNNING_HOUR_IN = 18
const RUNNING_HOUR_OUT = 12
/** A futó óra teljes értéke — az élő számláló eddig léphet. */
export const RUNNING_HOUR_FULL_IN = FULL_DAY_IN[RUNNING_HOUR - OPEN_HOURS.start] ?? 0
export const RUNNING_HOUR_FULL_OUT =
  FULL_DAY_OUT[RUNNING_HOUR - OPEN_HOURS.start] ?? 0

export const TODAY_HOURLY: TodayHour[] = HOUR_LABELS.map((_, i) => {
  const hour = OPEN_HOURS.start + i
  const running = hour === RUNNING_HOUR
  const pending = hour > RUNNING_HOUR
  return {
    hour,
    inCount: pending ? 0 : running ? RUNNING_HOUR_IN : (FULL_DAY_IN[i] ?? 0),
    outCount: pending
      ? 0
      : running
        ? RUNNING_HOUR_OUT
        : (FULL_DAY_OUT[i] ?? 0),
    pending,
    running
  }
})

/** Eddigi mai be / ki — a chart oszlopainak összege. */
export const TODAY_SO_FAR_IN = TODAY_HOURLY.reduce(
  (s, h) => s + h.inCount,
  0
)
export const TODAY_SO_FAR_OUT = TODAY_HOURLY.reduce(
  (s, h) => s + h.outCount,
  0
)
export const TODAY_OCCUPANCY = Math.max(
  0,
  TODAY_SO_FAR_IN - TODAY_SO_FAR_OUT
)

export const TODAY_PEAK_HOUR = TODAY_HOURLY.reduce((best, h) =>
  h.inCount > best.inCount ? h : best
)

export const TODAY_MAX_HOUR_IN = Math.max(
  ...TODAY_HOURLY.map((h) => h.inCount)
)

/** Ugyanezen hétköznap átlaga — a mai szám viszonyítási pontja. */
export const TODAY_WEEKDAY_AVG =
  WEEKDAY_PROFILE[TODAY.weekday]?.avgIn ?? MONTH_AVG_IN

export type SeasonMonth = {
  key: string
  label: string
  totalIn: number
  selected?: boolean
}

/** Utolsó 12 hónap — az utolsó elem a demo hónap tényleges összege. */
export const SEASON_MONTHS: SeasonMonth[] = [
  { key: '2025-04', label: 'ápr.', totalIn: 4210 },
  { key: '2025-05', label: 'máj.', totalIn: 4680 },
  { key: '2025-06', label: 'jún.', totalIn: 4890 },
  { key: '2025-07', label: 'júl.', totalIn: 4520 },
  { key: '2025-08', label: 'aug.', totalIn: 4080 },
  { key: '2025-09', label: 'szept.', totalIn: 4610 },
  { key: '2025-10', label: 'okt.', totalIn: 4380 },
  { key: '2025-11', label: 'nov.', totalIn: 3950 },
  { key: '2025-12', label: 'dec.', totalIn: 3480 },
  { key: '2026-01', label: 'jan.', totalIn: 3120 },
  { key: '2026-02', label: 'febr.', totalIn: 3640 },
  {
    key: '2026-03',
    label: 'márc.',
    totalIn: MONTH_TOTAL_IN,
    selected: true
  }
]

export const SEASON_MAX = Math.max(...SEASON_MONTHS.map((m) => m.totalIn))

export const SEASON_BEST = SEASON_MONTHS.reduce((best, m) =>
  m.totalIn > best.totalIn ? m : best
)

export const SEASON_WORST = SEASON_MONTHS.reduce((worst, m) =>
  m.totalIn < worst.totalIn ? m : worst
)

/** Előző hónap — a naptárhatás leválasztásához kell a nyitvatartási napszám. */
export const PREV_MONTH = {
  label: '2026. február',
  totalIn: SEASON_MONTHS.at(-2)?.totalIn ?? 0,
  openDays: 24
} as const

/** Változás az előző hónaphoz — összesen és nyitvatartási napra vetítve. */
export const MOM_CHANGE_PCT =
  PREV_MONTH.totalIn === 0
    ? 0
    : Math.round(
        ((MONTH_TOTAL_IN - PREV_MONTH.totalIn) / PREV_MONTH.totalIn) * 1000
      ) / 10

export const PREV_MONTH_AVG_IN = Math.round(
  PREV_MONTH.totalIn / PREV_MONTH.openDays
)

export const MOM_PER_DAY_CHANGE_PCT =
  PREV_MONTH_AVG_IN === 0
    ? 0
    : Math.round(
        ((MONTH_AVG_IN - PREV_MONTH_AVG_IN) / PREV_MONTH_AVG_IN) * 1000
      ) / 10

export type WeatherBucket = {
  key: DemoWeather
  label: string
  hint: string
  days: number
  avgIn: number
  /** Eltérés a hónap nyitvatartási átlagától, százalékban. */
  deltaPct: number
}

const WEATHER_META: Record<DemoWeather, { label: string; hint: string }> = {
  dry: { label: 'Csapadékmentes', hint: 'Nyitvatartás alatt nem esett' },
  rain: {
    label: 'Esős',
    hint: 'Legalább 2 órán át 0,5 mm vagy több csapadék'
  },
  wind: {
    label: 'Szeles',
    hint: 'A legnagyobb szélsebesség legalább 25 km/h'
  },
  heat: { label: 'Meleg (28 °C felett)', hint: 'Napi maximum 28 °C felett' }
}

export const WEATHER_BUCKETS: WeatherBucket[] = (
  ['dry', 'rain', 'wind', 'heat'] as DemoWeather[]
)
  .map((key) => {
    const days = OPEN_DAYS.filter((d) => d.weather === key)
    const avgIn =
      days.length > 0
        ? Math.round(days.reduce((s, d) => s + d.inCount, 0) / days.length)
        : 0
    return {
      key,
      label: WEATHER_META[key].label,
      hint: WEATHER_META[key].hint,
      days: days.length,
      avgIn,
      deltaPct:
        avgIn > 0
          ? Math.round(((avgIn - MONTH_AVG_IN) / MONTH_AVG_IN) * 100)
          : 0
    }
  })
  .filter((b) => b.days > 0)

export const RAIN_BUCKET = WEATHER_BUCKETS.find((b) => b.key === 'rain')
export const DRY_BUCKET = WEATHER_BUCKETS.find((b) => b.key === 'dry')

/**
 * A hu-HU locale csak 2+ jegyű bal oldali csoportnál rak ezres elválasztót
 * (4693 → „4693"), ezért kell a `useGrouping: 'always'` — ahogy az árazásnál is.
 */
const COUNT_FORMATTER = new Intl.NumberFormat('hu-HU', {
  maximumFractionDigits: 0,
  useGrouping: 'always'
})

export function formatCount(value: number): string {
  return COUNT_FORMATTER.format(value)
}

export function formatSignedPct(value: number): string {
  const rounded = Math.round(value * 10) / 10
  const sign = rounded > 0 ? '+' : ''
  return `${sign}${rounded.toLocaleString('hu-HU', {
    maximumFractionDigits: 1
  })}%`
}
