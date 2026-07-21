/**
 * Bolti analitika CoreFeatures
 *
 * Two features + one full-width upsell callout:
 *   F1: "Mai forgalom" home widget (mirrors FootcounterHomeCard)
 *   F2: "7 nap × óra" heatmap (mirrors /footcounter-live heatmap)
 *   Upsell callout: "Kapcsold össze Turinova POS-szal → konverzió forintra"
 *     (honest: we don't promise conversion without POS, but we make the path visible)
 */

// ---------------------------------------------------------------------------
// F1 mock: "Mai forgalom" home widget (full fidelity)
// ---------------------------------------------------------------------------
const PULSE_HOURLY = [4, 9, 15, 22, 28, 24, 17, 19, 27, 31, 20]
const PULSE_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]
const PULSE_TODAY_IN = 182
const PULSE_TODAY_OUT = 168
const PULSE_PEAK_HOUR = 17
const PULSE_PEAK_VAL = 31
const PULSE_ACTIVE_H = 11

function heatCellStyle(value: number, max: number) {
  if (value <= 0) return { background: 'rgba(59,130,246,0.06)' }
  const t = Math.min(1, value / max)
  const opacity = 0.12 + t * 0.68

  return { background: `rgba(37,99,235,${opacity.toFixed(2)})` }
}

function PulseHomeMock() {
  const max = Math.max(...PULSE_HOURLY)
  const currentHour = 14

  return (
    <div
      className="relative bg-white rounded-2xl overflow-hidden"
      style={{
        border: '1px solid #E4E4E7',
        boxShadow: '0 25px 60px rgba(24,24,27,0.12), 0 4px 12px rgba(24,24,27,0.04)',
      }}
    >
      {/* Left accent stripe like the real card */}
      <div aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px] bg-emerald-500/60" />

      <div className="pl-4 pr-4 py-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 5v2m0 3v2m0 3v2m0 3v2M6 20h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z" />
            </svg>
            <p className="text-sm font-semibold text-slate-800">Mai forgalom</p>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
            Számláló aktív
          </span>
        </div>

        {/* Stats header: napi eloszlás | csúcs | aktív */}
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[11px] text-slate-500 font-medium">Napi eloszlás</p>
          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            <span>
              Csúcs: <span className="text-blue-600 font-bold tabular-nums">{PULSE_PEAK_HOUR}:00</span>{' '}
              <span className="text-slate-700 font-semibold tabular-nums">({PULSE_PEAK_VAL})</span>
            </span>
            <span>
              Aktív: <span className="text-slate-700 font-bold tabular-nums">{PULSE_ACTIVE_H}h</span>
            </span>
          </div>
        </div>

        {/* Main row: belépő | heatmap | kilépő */}
        <div className="flex items-center gap-3">
          {/* Belépő */}
          <div className="text-center flex-shrink-0 min-w-[64px]">
            <p className="text-3xl font-extrabold leading-none tabular-nums text-emerald-600">
              {PULSE_TODAY_IN}
            </p>
            <p className="text-[10px] text-slate-500 font-medium mt-1">belépő</p>
          </div>

          {/* Heatmap cells */}
          <div className="flex-1 min-w-0">
            <div className="flex gap-[3px] rounded overflow-hidden">
              {PULSE_HOURLY.map((v, i) => {
                const isCurrent = PULSE_HOURS[i] === currentHour

                return (
                  <div
                    key={PULSE_HOURS[i]}
                    className="flex-1 rounded-sm"
                    style={{
                      height: 30,
                      ...heatCellStyle(v, max),
                      ...(isCurrent ? { boxShadow: 'inset 0 0 0 2px #1d4ed8' } : {}),
                    }}
                  />
                )
              })}
            </div>
            {/* Hour labels */}
            <div className="flex gap-[3px] mt-1">
              {PULSE_HOURS.map(h => {
                const show = h === 8 || h === 13 || h === 18

                return (
                  <div key={h} className="flex-1 text-center">
                    {show ? (
                      <span className="text-[9px] text-slate-400 tabular-nums">{h}</span>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Kilépő */}
          <div className="text-center flex-shrink-0 min-w-[64px]">
            <p className="text-3xl font-extrabold leading-none tabular-nums text-orange-600">
              {PULSE_TODAY_OUT}
            </p>
            <p className="text-[10px] text-slate-500 font-medium mt-1">kilépő</p>
          </div>
        </div>

        {/* Legend gradient bar */}
        <div className="flex items-center gap-2 mt-2 px-[64px]">
          <span className="text-[9px] text-slate-400 tabular-nums">0</span>
          <div
            className="flex-1 h-1 rounded-full"
            style={{
              background: 'linear-gradient(90deg, rgba(37,99,235,0.08) 0%, rgba(37,99,235,0.8) 100%)',
            }}
          />
          <span className="text-[9px] text-slate-400 tabular-nums">{max}</span>
        </div>

        {/* Verdict row */}
        <div className="mt-3 flex items-center justify-between rounded-lg px-3 py-2 bg-emerald-50 border border-emerald-100">
          <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-emerald-700">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8-9 9-4-4-6 6" />
            </svg>
            Erős forgalom
          </span>
          <span className="text-[11px] text-emerald-700 font-semibold">+22% az átlaghoz képest</span>
        </div>

        {/* Footer */}
        <div className="mt-2 pt-2 border-t border-slate-100">
          <p className="text-[11px] text-slate-500">
            Utolsó észlelés: <strong className="text-slate-700 tabular-nums">04.21, 14:32</strong>
          </p>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// F2 mock: 7 day × hour heatmap (mirrors /footcounter-live)
// ---------------------------------------------------------------------------
const HEATMAP_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17]
const HEATMAP_DAYS = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V']
const HEATMAP_VALUES: number[][] = [
  [2, 5, 8, 12, 18, 20, 16, 14, 22, 28],
  [3, 6, 9, 13, 17, 19, 15, 13, 21, 26],
  [2, 4, 7, 11, 16, 18, 14, 12, 20, 24],
  [3, 5, 8, 12, 17, 19, 15, 13, 21, 25],
  [4, 7, 10, 14, 20, 22, 18, 16, 24, 32],
  [6, 10, 14, 19, 28, 30, 20, 10, 4, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
]

function HeatmapWeekMock() {
  const flat = HEATMAP_VALUES.flat()
  const max = Math.max(1, ...flat)

  return (
    <div
      className="relative bg-white rounded-2xl overflow-hidden p-5"
      style={{
        border: '1px solid #E4E4E7',
        boxShadow: '0 25px 60px rgba(24,24,27,0.12), 0 4px 12px rgba(24,24,27,0.04)',
      }}
    >
      {/* Header */}
      <div className="mb-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-800">Be forgalom: nap × óra</p>
          <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200">
            Utolsó 28 nap
          </span>
        </div>
        <p className="text-[11px] text-slate-500 mt-0.5">Hol van tipikusan a csúcs, és mikor érdemes kampányt időzíteni.</p>
      </div>

      {/* Grid */}
      <div className="overflow-hidden">
        {/* Hour header */}
        <div className="flex items-center gap-[3px] ml-[28px] mb-1">
          {HEATMAP_HOURS.map(h => (
            <div key={h} className="flex-1 text-center">
              <span className="text-[9px] text-slate-400 tabular-nums">{h}</span>
            </div>
          ))}
        </div>

        {/* Rows */}
        <div className="space-y-[3px]">
          {HEATMAP_DAYS.map((day, row) => {
            const rowVals = HEATMAP_VALUES[row] ?? []

            return (
              <div key={day} className="flex items-center gap-[3px]">
                <div className="w-[24px] text-[10px] text-slate-500 font-semibold text-right pr-1">
                  {day}
                </div>
                {rowVals.map((v, col) => (
                  <div
                    key={col}
                    className="flex-1 rounded-sm"
                    style={{
                      height: 26,
                      ...heatCellStyle(v, max),
                    }}
                    title={`${day} ${HEATMAP_HOURS[col]}:00 — ${v} belépő`}
                  />
                ))}
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="mt-3 flex items-center gap-2 ml-[28px]">
          <span className="text-[10px] text-slate-400 tabular-nums">kevés</span>
          <div
            className="flex-1 h-1.5 rounded-full"
            style={{
              background: 'linear-gradient(90deg, rgba(37,99,235,0.08) 0%, rgba(37,99,235,0.8) 100%)',
            }}
          />
          <span className="text-[10px] text-slate-400 tabular-nums">sok</span>
        </div>
      </div>

      {/* Insight callouts */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider font-bold text-blue-700">Heti csúcs</p>
          <p className="text-[13px] font-bold text-slate-800 mt-0.5">Szombat 13:00</p>
        </div>
        <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-600">Leggyengébb</p>
          <p className="text-[13px] font-bold text-slate-800 mt-0.5">Vasárnap (zárva)</p>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Feature block
// ---------------------------------------------------------------------------
type Feature = {
  id: string
  eyebrow: string
  title: string
  kpi: string
  kpiLabel: string
  copy: string
  bullets: string[]
  mock: React.FC
  reverse?: boolean
}

const features: Feature[] = [
  {
    id: 'daily',
    eyebrow: 'Napi áttekintés',
    title: 'Egy pillantással lásd, hogyan telik a nap a boltodban.',
    kpi: '1 másodperc',
    kpiLabel: 'alatt frissül a dashboard',
    copy:
      'A főképernyőn azonnal látszik, hányan léptek be és hányan mentek ki ma, mikor van a csúcs, és hogy a nap az elmúlt hónap átlagához képest erős, átlagos vagy gyenge. Nem kell külön oldalra kattintanod, nem kell riportot futtatnod.',
    bullets: [
      'Valós idejű belépő- és kilépő-számláló, a bejárat fölé szerelt diszkrét szenzorral.',
      'Napi hőtérkép óránkénti bontásban — látod, mikor jönnek be a vásárlók, és mikor van csúcsidő.',
      'Automatikus napértékelés: erős, átlagos vagy gyenge nap, az elmúlt 28 nap átlagához viszonyítva.',
    ],
    mock: PulseHomeMock,
  },
  {
    id: 'heatmap',
    eyebrow: 'Heti mintázat',
    title: 'Lásd, mikor erősítsd a műszakot, és mikor indítsd a kampányt.',
    kpi: '28 nap',
    kpiLabel: 'mozgóátlaga, nap × óra bontásban',
    copy:
      'Az elmúlt 28 nap forgalma egyetlen hőtérképen: azonnal látod, melyik napon és melyik órában szokott tele lenni a bolt. Erre építhetsz műszakot, akciót vagy SMS-kampányt — nem érzésre, hanem adatra.',
    bullets: [
      'Nap × óra hőtérkép hétfőtől vasárnapig, óránkénti bontásban.',
      'Két kattintással szűrhetsz nyitvatartási időszakra vagy egész napra.',
      'A heti csúcs és a leggyengébb nap automatikusan ki van emelve — nem csak egy táblázat, hanem konkrét döntéstámogatás.',
    ],
    mock: HeatmapWeekMock,
    reverse: true,
  },
]

function FeatureBlock({ f }: { f: Feature }) {
  const Mock = f.mock

  return (
    <div
      className={`grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-8 lg:gap-14 xl:gap-16 items-center ${
        f.reverse ? 'lg:[&>div:first-child]:order-2' : ''
      }`}
    >
      <div>
        <span
          className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-widest border"
          style={{ background: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' }}
        >
          {f.eyebrow}
        </span>
        <h3
          className="mt-4 text-[1.75rem] sm:text-[2rem] lg:text-[2.125rem] xl:text-[2.375rem] font-extrabold leading-[1.1] tracking-tight"
          style={{ color: '#18181B' }}
        >
          {f.title}
        </h3>
        <div
          className="mt-4 inline-flex items-baseline gap-1.5 px-3 py-1.5 rounded-lg border"
          style={{ background: '#EFF6FF', borderColor: '#BFDBFE' }}
        >
          <span className="text-lg font-extrabold leading-none" style={{ color: '#1D4ED8' }}>
            {f.kpi}
          </span>
          <span className="text-[12px] font-medium leading-none" style={{ color: '#52525B' }}>
            {f.kpiLabel}
          </span>
        </div>

        <p className="mt-6 text-base sm:text-lg leading-relaxed" style={{ color: '#52525B' }}>
          {f.copy}
        </p>

        <ul className="mt-6 space-y-3">
          {f.bullets.map(b => (
            <li key={b} className="flex gap-3 text-sm sm:text-[15px] leading-snug" style={{ color: '#3F3F46' }}>
              <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                style={{ background: '#DBEAFE', color: '#1D4ED8' }}
                aria-hidden
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <Mock />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Upsell callout: POS integration
// ---------------------------------------------------------------------------
function UpsellCallout() {
  return (
    <div
      className="relative overflow-hidden rounded-3xl p-6 sm:p-8 lg:p-10"
      style={{
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)',
        border: '1px solid rgba(59,130,246,0.25)',
        boxShadow: '0 25px 60px rgba(15,23,42,0.25), 0 0 40px rgba(37,99,235,0.08)',
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 h-[320px] w-[320px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.22) 0%, transparent 65%)' }}
      />

      <div className="relative grid grid-cols-1 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] gap-8 lg:gap-12 items-center">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-blue-200">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Plusz · Turinova ERP mellé
          </span>
          <h3 className="mt-4 text-2xl sm:text-3xl lg:text-[2.125rem] font-extrabold leading-[1.15] tracking-tight text-white">
            Kösd össze a POS-szal, és a konverziót forintra pontosan látod.
          </h3>
          <p className="mt-4 text-base leading-relaxed text-slate-300">
            Ha a Turinova Webshop ERP vagy Asztalos ERP kasszarendszerét használod, a Vendégszámláló összeveti a boltba belépők számát az eladások számával. Ettől a ponttól nem csak a forgalmat látod, hanem a <strong className="text-white">konverziós rátát</strong> és a <strong className="text-white">látogatónkénti bevételt</strong> is, naponként.
          </p>
          <ul className="mt-5 space-y-2">
            {[
              'Konverziós ráta napra és órára bontva, trenddel és eltérésjelzéssel.',
              'Bevétel egy látogatóra vetítve: látod, mely napokon dolgozik leghatékonyabban a bolt.',
              'Kampányhatás-mérés: akció előtti és utáni konverzió egy kattintással összehasonlítható.',
            ].map(line => (
              <li key={line} className="flex gap-2.5 text-[14px] leading-snug text-slate-300">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-300">
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Mini teaser mock: locked conversion card */}
        <div className="relative">
          <div
            className="rounded-2xl p-5 bg-slate-900/60 backdrop-blur-sm"
            style={{ border: '1px solid rgba(59,130,246,0.25)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] uppercase tracking-widest text-blue-300 font-bold">
                Élő konverzió · Ma
              </p>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 lvj-live-dot" />
                LIVE
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 p-3">
                <p className="text-[10px] uppercase text-slate-400 font-semibold">Konverzió</p>
                <p className="mt-1 text-2xl font-extrabold text-emerald-300 tabular-nums">22,4%</p>
                <p className="text-[10px] text-emerald-400 mt-0.5">+1,8% a múlt héthez</p>
              </div>
              <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 p-3">
                <p className="text-[10px] uppercase text-slate-400 font-semibold">Ft / látogató</p>
                <p className="mt-1 text-2xl font-extrabold text-blue-300 tabular-nums">2.040</p>
                <p className="text-[10px] text-slate-400 mt-0.5">átlag kosárérték × konv.</p>
              </div>
            </div>

            {/* Mini sparkline */}
            <div className="mt-4 flex items-end gap-1 h-10">
              {[18, 22, 19, 24, 21, 26, 22, 28, 24, 29, 25, 31].map((v, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-sm"
                  style={{
                    height: `${v * 3}%`,
                    background: 'linear-gradient(180deg, #60A5FA 0%, #2563EB 100%)',
                  }}
                />
              ))}
            </div>
            <p className="mt-2 text-[10px] text-slate-500">Konverzió 12 órás trend</p>
          </div>

          {/* "Unlocks with ERP" badge */}
          <div className="absolute -top-3 -right-3 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[10px] font-bold text-white bg-blue-600 shadow-lg" style={{ boxShadow: '0 0 24px rgba(37,99,235,0.55)' }}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Turinova ERP mellett
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CoreFeatures() {
  return (
    <section id="features" className="relative py-14 sm:py-20" style={{ background: '#F9F8F4' }}>
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10 xl:px-14">
        <div className="text-center max-w-5xl mx-auto mb-10 sm:mb-14">
          <span
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-widest"
            style={{ background: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' }}
          >
            Fő funkciók
          </span>
          <h2
            className="mt-4 text-3xl sm:text-4xl lg:text-[2.5rem] font-extrabold tracking-tight leading-[1.1]"
            style={{ color: '#18181B' }}
          >
            Napi forgalom a főképernyőn, heti mintázat a stratégiához.
          </h2>
          <p className="mt-4 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto" style={{ color: '#52525B' }}>
            Két dolog kell, hogy jobban vezesd a boltodat: egy gyors napi áttekintés és egy visszatérő heti mintázat, amit megért az ember. A többi már rajtad múlik.
          </p>
        </div>

        <div className="flex flex-col gap-14 sm:gap-20">
          {features.map(f => (
            <FeatureBlock key={f.id} f={f} />
          ))}

          <UpsellCallout />
        </div>
      </div>
    </section>
  )
}
