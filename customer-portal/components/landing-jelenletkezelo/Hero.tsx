'use client'

/**
 * Jelenletkezelo landing Hero (v3)
 *
 * v3 changes vs v2:
 *   1. Em/en-dashes removed from all visible strings.
 *   2. Dropped the "A tobbit a rendszer elintezi" subline.
 *   3. Kiosk and live dashboard placed side-by-side in the right column
 *      instead of stacked vertically. Reduces hero height ~40%.
 *   4. No more flow-arrow connector (story reads left-to-right naturally).
 */

type DashCard = {
  key: string
  name: string
  status: 'in' | 'left' | 'holi' | 'none'
  arrival: string | null
}

const dashCards: DashCard[] = [
  { key: 'pk', name: 'Kovács P.', status: 'in', arrival: '08:02' },
  { key: 'ne', name: 'Nagy E.', status: 'in', arrival: '07:58' },
  { key: 'sa', name: 'Szabó A.', status: 'in', arrival: '08:05' },
  { key: 'tg', name: 'Tóth G.', status: 'left', arrival: '08:10' },
  { key: 'hb', name: 'Horváth B.', status: 'holi', arrival: null },
  { key: 'kl', name: 'Kiss L.', status: 'none', arrival: null },
]

function dashCardStyle(status: DashCard['status']) {
  switch (status) {
    case 'in':
      return { bg: '#E8F5EE', border: '#7CB89A', chipBg: '#E8F5EE', chipBorder: '#B8DEC9', chipText: '#2F6F4F' }
    case 'left':
      return { bg: '#FFF8E8', border: '#E8B86D', chipBg: '#FFF8E8', chipBorder: '#F0D08A', chipText: '#8B5A00' }
    case 'holi':
      return { bg: '#FDECEC', border: '#E57373', chipBg: '#FDECEC', chipBorder: '#EF9A9A', chipText: '#B71C1C' }
    default:
      return { bg: '#FAFAF8', border: '#DDD8CF', chipBg: '#F5F3EF', chipBorder: '#D4CFC4', chipText: '#5C5A57' }
  }
}

export default function Hero() {
  return (
    <section
      id="home"
      className="relative w-full overflow-hidden pt-12 pb-10 sm:pt-14 sm:pb-14"
      style={{
        background: 'linear-gradient(145deg, #0F1114 0%, #0B0D11 55%, #111722 100%)',
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(219,234,254,0.05) 1px, transparent 0)',
          backgroundSize: '36px 36px',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-40 h-[640px] w-[640px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.28) 0%, transparent 62%)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-32 h-[520px] w-[520px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.14) 0%, transparent 65%)' }}
      />

      <div className="relative mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10 xl:px-14">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-10 lg:gap-14 xl:gap-20 items-center">
          {/* Left text column */}
          <div className="flex flex-col gap-7">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-widest text-blue-200 backdrop-blur-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-400" />
                </span>
                Magyar cégeknek, 10-30 fős csapatra tervezve
              </span>
            </div>

            <h1
              className="text-[2.25rem] sm:text-5xl lg:text-[3.5rem] xl:text-[4rem] font-extrabold tracking-tight leading-[1.05]"
              style={{ color: '#F8FAFC' }}
            >
              Tudd meg percre pontosan,{' '}
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage: 'linear-gradient(135deg, #60A5FA 0%, #3B82F6 60%, #2563EB 100%)',
                }}
              >
                ki dolgozik most
              </span>
              .
            </h1>

            <p className="text-lg sm:text-xl leading-relaxed max-w-[560px]" style={{ color: '#CBD5E1' }}>
              Kártyás vagy PIN-kódos beléptető terminál. Valós idejű dashboard. Havi jelenléti ív egy kattintásra.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <a
                href="#roi"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-[15px] font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors duration-150"
                style={{ boxShadow: '0 0 32px rgba(37,99,235,0.5), 0 6px 18px rgba(37,99,235,0.35)' }}
              >
                Számold ki 20 mp alatt, mennyit veszítesz évente
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
                Offline módban is fut
              </span>
              <span className="inline-flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                Hardver havi díjban
              </span>
              <span className="inline-flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                GDPR megfelelő
              </span>
            </div>
          </div>

          {/* Right mocks column (kiosk and dashboard side-by-side on desktop) */}
          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,0.75fr)_minmax(0,1fr)] gap-5 sm:gap-6 items-center">
            {/* Kiosk */}
            <div className="relative mx-auto w-full max-w-[280px] sm:max-w-none">
              <div
                className="rounded-[22px] p-3"
                style={{
                  background: 'linear-gradient(160deg, #3f2a1b 0%, #271a10 55%, #3a2718 100%)',
                  boxShadow: '0 25px 50px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)',
                }}
              >
                <div className="mb-2 flex items-center justify-between text-[9px] tracking-wider text-amber-100/40 font-semibold uppercase">
                  <span>Turinova terminál</span>
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 lvj-live-dot" />
                    LIVE
                  </span>
                </div>

                <div
                  className="relative overflow-hidden rounded-[10px]"
                  style={{
                    aspectRatio: '4 / 3',
                    background: '#000',
                    boxShadow: 'inset 0 0 0 2px #0a0a0a',
                  }}
                >
                  {/* Idle clock state */}
                  <div className="lvj-kiosk-clock absolute inset-0 flex flex-col items-center justify-center text-white">
                    <span className="text-[9px] tracking-widest text-blue-200/60 uppercase mb-1">
                      Kovács Gábor Kft.
                    </span>
                    <span className="text-4xl sm:text-5xl font-bold leading-none tabular-nums">
                      08<span className="opacity-60 mx-0.5">:</span>02
                    </span>
                    <span className="text-[10px] text-slate-400 mt-2">Kártyát vagy PIN-t kérünk</span>
                  </div>

                  {/* Card approaching */}
                  <div className="lvj-kiosk-card absolute inset-0 flex items-center justify-center">
                    <div
                      className="rounded-md border border-amber-200/60 px-3 py-1.5 text-[10px] font-semibold text-amber-100"
                      style={{
                        background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
                        boxShadow: '0 0 30px rgba(245,158,11,0.5)',
                      }}
                    >
                      RFID K-03421
                    </div>
                  </div>

                  {/* Processing flash */}
                  <div
                    className="lvj-kiosk-processing absolute inset-0 flex items-center justify-center"
                    style={{ background: 'rgba(76, 128, 178, 0.9)' }}
                  >
                    <span className="text-white text-base font-bold tracking-wide">Feldolgozás...</span>
                  </div>

                  {/* Green arrival (matches real system: solid green, ÉRKEZÉS and name only, no timestamp) */}
                  <div
                    className="lvj-kiosk-arrival absolute inset-0 flex flex-col items-center justify-center"
                    style={{ background: '#33CC33' }}
                  >
                    <span className="text-white text-2xl sm:text-3xl font-extrabold tracking-wider">
                      ÉRKEZÉS
                    </span>
                    <span className="text-white text-base sm:text-lg font-bold mt-1">
                      Kovács Péter
                    </span>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between text-[9px] text-amber-100/30">
                  <span>7&quot; érintőkijelző</span>
                  <span>RFID, PIN, Offline</span>
                </div>
              </div>
            </div>

            {/* Dashboard */}
            <div className="relative">
              <div
                className="rounded-2xl overflow-hidden bg-white"
                style={{
                  border: '1px solid rgba(59,130,246,0.25)',
                  boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 40px rgba(59,130,246,0.12)',
                }}
              >
                <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border-b border-slate-200">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-300" />
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-300" />
                  <span className="w-2.5 h-2.5 rounded-full bg-green-300" />
                  <div className="ml-2 flex items-center px-2 h-4 rounded-md bg-white border border-slate-200 text-[9px] text-slate-500 min-w-0 flex-1 max-w-[240px] truncate">
                    mintaceg.hu/home
                  </div>
                </div>

                <div className="px-3 pt-2.5 pb-1.5 border-b border-black/[0.08] bg-white">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-slate-800">Mai jelenlét</p>
                    <span className="text-[10px] text-slate-400">2026. április 21.</span>
                  </div>
                </div>

                <div className="px-3 py-1.5 border-b border-black/[0.08] bg-white flex flex-wrap items-center gap-1">
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold border bg-[#E8F5EE] text-[#2F6F4F] border-[#B8DEC9]">
                    Bent: 8
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold border bg-[#FFF8E8] text-[#8B5A00] border-[#F0D08A]">
                    Távozott: 1
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold border bg-[#FDECEC] text-[#B71C1C] border-[#EF9A9A]">
                    Szabadság: 1
                  </span>
                </div>

                <div className="p-2.5 bg-[#FBFBFA]">
                  <div className="grid grid-cols-3 gap-1.5">
                    {dashCards.map(c => {
                      const st = dashCardStyle(c.status)

                      return (
                        <div
                          key={c.key}
                          className="rounded-md border px-1.5 py-1"
                          style={{ backgroundColor: st.bg, borderColor: st.border }}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[9px] font-bold text-slate-800 truncate">{c.name}</span>
                            {c.status === 'holi' ? (
                              <span
                                className="text-[7px] font-bold px-1 py-[1px] rounded border whitespace-nowrap"
                                style={{ background: st.chipBg, color: st.chipText, borderColor: st.chipBorder }}
                              >
                                SZ
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-0.5 flex items-baseline justify-between">
                            <span className="text-[7px] text-slate-500">Érk.</span>
                            <span className="text-[9px] font-bold text-slate-800 tabular-nums">
                              {c.arrival ?? '...'}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="px-3 py-1.5 bg-[#FBFBFA] border-t border-black/[0.08]">
                  <p className="text-[9px] text-slate-500">
                    A terminálon történt belépés után <strong className="text-slate-700">1 mp-en belül</strong> frissül.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
