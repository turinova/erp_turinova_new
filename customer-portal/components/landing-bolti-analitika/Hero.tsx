'use client'

/**
 * Bolti Analitika Hero (v5, real /home widget replica)
 *
 * Right column is a faithful, slightly larger reproduction of the real
 * `FootcounterHomeCard` that ships in the main app (/home). It's wrapped
 * in a browser chrome so the CEO immediately understands: "this is exactly
 * what I'll see when I log in every morning". A secondary compact 7-day
 * strip card is shown below it for strategic context (heti áttekintés).
 *
 * Interactivity:
 *   - Pure-CSS :hover on every heatmap cell reveals a tooltip with the exact
 *     hour and entry count — matching the <Tooltip> behaviour of the real
 *     MUI-based card, without pulling MUI into the landing bundle.
 *   - Hover also slightly brightens the cell.
 */

// ---------------------------------------------------------------------------
// Mock data — mirrors FootcounterHomeSlim shape from the real app
// ---------------------------------------------------------------------------
// Hourly entries for 7:00 – 18:00 (12 cells, same window as the real card).
const HOURLY_IN = [0, 3, 7, 12, 18, 22, 19, 14, 16, 24, 28, 17]
const HOUR_START = 7
const HOUR_END = 18
const TODAY_IN = 147
const TODAY_OUT = 134
const TODAY_DELTA_PCT = 18 // +18% vs same-weekday average
const LAST_SEEN = '04.21, 14:32'

// Mini 7-day strip (secondary card)
const WEEKLY_TOTALS = [134, 147, 142, 138, 156, 189, 0]
const WEEKLY_LABELS = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V']
const TODAY_IDX = 1

function heatCellStyle(value: number, max: number) {
  if (value <= 0) return { background: 'rgba(59,130,246,0.06)' }
  const t = Math.min(1, value / max)
  const opacity = 0.12 + t * 0.7

  return { background: `rgba(37,99,235,${opacity.toFixed(2)})` }
}

export default function Hero() {
  const slice = HOURLY_IN.slice(0, HOUR_END - HOUR_START + 1)
  const heatMax = Math.max(1, ...slice)
  const peakIdx = slice.indexOf(Math.max(...slice))
  const peakHour = HOUR_START + peakIdx
  const peakVal = slice[peakIdx]
  const activeHours = slice.filter(v => v > 0).length
  const currentHour = 14

  const weeklyMax = Math.max(...WEEKLY_TOTALS)

  return (
    <section
      id="home"
      className="relative w-full overflow-hidden pt-12 pb-10 sm:pt-14 sm:pb-14"
      style={{
        background: 'linear-gradient(145deg, #0F1114 0%, #0B0D11 55%, #111722 100%)',
      }}
    >
      {/* Dot grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(219,234,254,0.05) 1px, transparent 0)',
          backgroundSize: '36px 36px',
        }}
      />
      {/* Glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-40 h-[640px] w-[640px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.28) 0%, transparent 62%)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-32 h-[520px] w-[520px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.18) 0%, transparent 65%)' }}
      />

      <div className="relative mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10 xl:px-14">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] gap-10 lg:gap-14 xl:gap-16 items-center">
          {/* ---------------- Left text column ---------------- */}
          <div className="flex flex-col gap-7">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-widest text-blue-200 backdrop-blur-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-400" />
                </span>
                Kiskereskedőknek · Egy nap alatt üzembe áll
              </span>
            </div>

            <h1
              className="text-[2.25rem] sm:text-5xl lg:text-[3.5rem] xl:text-[4rem] font-extrabold tracking-tight leading-[1.05]"
              style={{ color: '#F8FAFC' }}
            >
              Lásd pontosan, hányan lépnek be a boltodba,{' '}
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage: 'linear-gradient(135deg, #60A5FA 0%, #3B82F6 60%, #2563EB 100%)',
                }}
              >
                és mikor
              </span>
              .
            </h1>

            <p className="text-lg sm:text-xl leading-relaxed max-w-[560px]" style={{ color: '#CBD5E1' }}>
              Egy diszkrét szenzor a bejárat fölött. Minden belépőt percre pontosan megszámol, és napi dashboardot, heti hőtérképet ad a kezedbe. Arcot nem rögzítünk, internetre nem kötjük, és nincs szükség IT-csapatra sem.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <a
                href="#roi"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-[15px] font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors duration-150"
                style={{ boxShadow: '0 0 32px rgba(37,99,235,0.5), 0 6px 18px rgba(37,99,235,0.35)' }}
              >
                Számold ki, mennyit ér +1% konverzió
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </a>
              <a
                href="#demo"
                className="inline-flex items-center justify-center gap-2 px-5 py-3.5 text-[15px] font-semibold text-slate-200 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-white/20 transition-colors duration-150"
              >
                Kérek egy bemutatót
              </a>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-slate-400 pt-1">
              <span className="inline-flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                Arcot nem rögzít (GDPR-megfelelő)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                Internet nélkül is működik
              </span>
              <span className="inline-flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                Egyszeri vásárlás, nincs havi előfizetés
              </span>
            </div>
          </div>

          {/* ---------------- Right: real /home widget replica ---------------- */}
          <div className="relative w-full max-w-[520px] mx-auto lg:ml-auto lg:mr-0">
            {/* Decorative glow behind the card */}
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-4 rounded-[28px]"
              style={{
                background:
                  'radial-gradient(ellipse at 30% 20%, rgba(37,99,235,0.2) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(16,185,129,0.16) 0%, transparent 60%)',
                filter: 'blur(20px)',
              }}
            />

            <div
              className="relative rounded-2xl overflow-hidden"
              style={{
                background: '#F7F6F1',
                border: '1px solid rgba(59,130,246,0.25)',
                boxShadow: '0 35px 80px rgba(0,0,0,0.5), 0 0 40px rgba(59,130,246,0.12)',
              }}
            >
              {/* Browser chrome */}
              <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border-b border-slate-200">
                <span className="w-2.5 h-2.5 rounded-full bg-red-300" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-300" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-300" />
                <div className="ml-2 flex items-center gap-1.5 px-2.5 h-5 rounded-md bg-white border border-slate-200 text-[10px] text-slate-500 min-w-0 flex-1 max-w-[260px] truncate">
                  <svg className="w-2.5 h-2.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2Zm10-9V7a4 4 0 1 0-8 0v4h8Z" />
                  </svg>
                  <span className="truncate">mintabolt.turinova.hu/home</span>
                </div>
              </div>

              {/* Widget pane content */}
              <div className="p-4 sm:p-5 space-y-4">
                {/* ================= Mai forgalom card (mirrors FootcounterHomeCard) ================= */}
                <div
                  className="relative rounded-xl bg-white overflow-hidden"
                  style={{
                    border: '1px solid #E4E4E7',
                    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                  }}
                >
                  {/* Left accent stripe — emerald (busy mood) */}
                  <div
                    aria-hidden
                    className="absolute left-0 top-0 bottom-0 w-[3px]"
                    style={{ background: 'rgba(16,185,129,0.5)', borderRadius: '3px 0 0 3px' }}
                  />

                  <div className="pl-4 pr-4 py-3.5">
                    {/* Header: walking icon + title | • Számláló aktív */}
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-1.5">
                        <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                          {/* DirectionsWalkOutlined silhouette */}
                          <path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2Zm-3.6 13.9 1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4Z" />
                        </svg>
                        <p className="text-[13px] font-semibold text-slate-800 leading-tight">Mai forgalom</p>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 lvj-live-dot" />
                        Számláló aktív
                      </span>
                    </div>

                    {/* Stats row: Napi eloszlás | Csúcs + Aktív */}
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[11px] text-slate-500 font-medium">Napi eloszlás</p>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500">
                        <span>
                          Csúcs:{' '}
                          <span className="text-blue-600 font-bold tabular-nums">{peakHour}:00</span>{' '}
                          <span className="text-slate-700 font-semibold tabular-nums">({peakVal})</span>
                        </span>
                        <span>
                          Aktív:{' '}
                          <span className="text-slate-700 font-bold tabular-nums">{activeHours}h</span>
                        </span>
                      </div>
                    </div>

                    {/* Main row: belépő | heatmap (interactive) | kilépő */}
                    <div className="flex items-center gap-3">
                      {/* Belépő left */}
                      <div className="text-center flex-shrink-0 min-w-[56px]">
                        <p
                          className="text-[1.6rem] font-extrabold leading-none tabular-nums text-emerald-600"
                          style={{ letterSpacing: '-0.03em' }}
                        >
                          {TODAY_IN}
                        </p>
                        <p className="text-[10px] text-slate-500 font-medium mt-1">belépő</p>
                      </div>

                      {/* Heatmap — HOVER INTERACTIVE with tooltips */}
                      <div className="flex-1 min-w-0">
                        <div className="flex gap-[3px] rounded overflow-visible">
                          {slice.map((v, i) => {
                            const hour = HOUR_START + i
                            const isCurrent = hour === currentHour

                            return (
                              <div
                                key={hour}
                                className="lba-heat-cell group relative flex-1 rounded-sm cursor-default"
                                style={{
                                  height: 32,
                                  ...heatCellStyle(v, heatMax),
                                  ...(isCurrent
                                    ? { boxShadow: 'inset 0 0 0 2px #1d4ed8' }
                                    : {}),
                                }}
                              >
                                {/* Tooltip on hover */}
                                <div
                                  className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-20"
                                  role="tooltip"
                                >
                                  <div
                                    className="relative whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold text-white tabular-nums"
                                    style={{
                                      background: '#0F172A',
                                      boxShadow: '0 8px 20px rgba(0,0,0,0.35)',
                                    }}
                                  >
                                    {hour}:00 — {v} belépő
                                    {/* Arrow */}
                                    <span
                                      aria-hidden
                                      className="absolute top-full left-1/2 -translate-x-1/2"
                                      style={{
                                        width: 0,
                                        height: 0,
                                        borderLeft: '5px solid transparent',
                                        borderRight: '5px solid transparent',
                                        borderTop: '5px solid #0F172A',
                                      }}
                                    />
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        {/* Hour labels */}
                        <div className="flex gap-[3px] mt-1">
                          {slice.map((_, i) => {
                            const hour = HOUR_START + i
                            const show = hour === HOUR_START || hour === 12 || hour === HOUR_END

                            return (
                              <div key={hour} className="flex-1 text-center">
                                {show ? (
                                  <span className="text-[9px] text-slate-400 tabular-nums">{hour}</span>
                                ) : null}
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Kilépő right */}
                      <div className="text-center flex-shrink-0 min-w-[56px]">
                        <p
                          className="text-[1.6rem] font-extrabold leading-none tabular-nums text-orange-600"
                          style={{ letterSpacing: '-0.03em' }}
                        >
                          {TODAY_OUT}
                        </p>
                        <p className="text-[10px] text-slate-500 font-medium mt-1">kilépő</p>
                      </div>
                    </div>

                    {/* Legend gradient bar */}
                    <div className="flex items-center gap-2 mt-2 px-[56px]">
                      <span className="text-[9px] text-slate-400 tabular-nums">0</span>
                      <div
                        className="flex-1 h-1 rounded-full"
                        style={{
                          background:
                            'linear-gradient(90deg, rgba(37,99,235,0.08) 0%, rgba(37,99,235,0.8) 100%)',
                        }}
                      />
                      <span className="text-[9px] text-slate-400 tabular-nums">{heatMax}</span>
                    </div>

                    {/* Verdict row */}
                    <div className="mt-3 flex items-center justify-between rounded-lg px-3 py-2 bg-emerald-50 border border-emerald-100">
                      <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-emerald-700">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8-9 9-4-4-6 6" />
                        </svg>
                        Erős forgalom
                      </span>
                      <span className="text-[11px] text-emerald-700 font-semibold">
                        +{TODAY_DELTA_PCT}% a heti átlaghoz képest
                      </span>
                    </div>

                    {/* Footer */}
                    <div className="mt-2 pt-2 border-t border-slate-100">
                      <p className="text-[11px] text-slate-500">
                        Utolsó észlelés:{' '}
                        <strong className="text-slate-700 tabular-nums font-semibold">{LAST_SEEN}</strong>
                      </p>
                    </div>
                  </div>
                </div>

                {/* ================= Secondary compact: 7 napos áttekintés ================= */}
                <div
                  className="relative rounded-xl bg-white overflow-hidden"
                  style={{
                    border: '1px solid #E4E4E7',
                    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                  }}
                >
                  <div
                    aria-hidden
                    className="absolute left-0 top-0 bottom-0 w-[3px]"
                    style={{ background: 'rgba(37,99,235,0.45)', borderRadius: '3px 0 0 3px' }}
                  />
                  <div className="pl-4 pr-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3M3 10h18M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z" />
                        </svg>
                        <p className="text-[12px] font-semibold text-slate-800">7 napos áttekintés</p>
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium">napi belépő</span>
                    </div>

                    <div className="flex items-end gap-[6px] h-[34px]">
                      {WEEKLY_TOTALS.map((v, i) => {
                        const isToday = i === TODAY_IDX
                        const isClosed = v === 0
                        const t = Math.min(1, v / weeklyMax)
                        const heightPct = isClosed ? 8 : 20 + t * 80

                        return (
                          <div
                            key={WEEKLY_LABELS[i]}
                            className="lba-week-bar group relative flex-1"
                            style={{ height: '100%' }}
                          >
                            <div
                              className="w-full rounded-sm transition-all group-hover:brightness-110"
                              style={{
                                height: `${heightPct}%`,
                                marginTop: `${100 - heightPct}%`,
                                background: isClosed
                                  ? 'repeating-linear-gradient(45deg, #E4E4E7 0 4px, #F4F4F5 4px 8px)'
                                  : isToday
                                    ? 'linear-gradient(180deg, #10B981 0%, #059669 100%)'
                                    : 'linear-gradient(180deg, #93C5FD 0%, #3B82F6 100%)',
                                boxShadow: isToday ? '0 0 0 1.5px #064E3B' : 'none',
                              }}
                            />
                            {/* Tooltip */}
                            <div
                              className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-20"
                              role="tooltip"
                            >
                              <div
                                className="relative whitespace-nowrap rounded-md px-2 py-0.5 text-[10px] font-semibold text-white tabular-nums"
                                style={{
                                  background: '#0F172A',
                                  boxShadow: '0 6px 16px rgba(0,0,0,0.3)',
                                }}
                              >
                                {WEEKLY_LABELS[i]}
                                {isClosed ? ' · zárva' : `: ${v} belépő`}
                                {isToday ? ' · ma' : ''}
                                <span
                                  aria-hidden
                                  className="absolute top-full left-1/2 -translate-x-1/2"
                                  style={{
                                    width: 0,
                                    height: 0,
                                    borderLeft: '4px solid transparent',
                                    borderRight: '4px solid transparent',
                                    borderTop: '4px solid #0F172A',
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="mt-1 flex gap-[6px]">
                      {WEEKLY_LABELS.map((d, i) => {
                        const isToday = i === TODAY_IDX

                        return (
                          <div key={d} className="flex-1 text-center">
                            <span
                              className="text-[10px] font-bold tabular-nums"
                              style={{ color: isToday ? '#065F46' : '#94A3B8' }}
                            >
                              {d}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .lba-heat-cell { transition: filter 180ms ease, transform 180ms ease; }
        .lba-heat-cell:hover { filter: brightness(1.22) saturate(1.1); transform: translateY(-1px); z-index: 10; }
      `}</style>
    </section>
  )
}
