'use client'

/** Mock rows aligned with shop-portal OrderBufferTable (teljesíthetőség + várakozás chips) */
const bufferRows = [
  { bolti: 'Shoprenter · Fő bolt', customer: 'Kovács Péter', amount: '14 900 Ft', wait: '8 perc', waitTier: 'fresh' as const, fulfill: 'all' as const, label: 'Raktáron' },
  { bolti: 'Shoprenter · Outlet', customer: 'Nagy Eszter', amount: '8 490 Ft', wait: '3 óra', waitTier: 'medium' as const, fulfill: 'partial' as const, label: 'Részben' },
  { bolti: 'Shoprenter · Fő bolt', customer: 'Tóth Gábor', amount: '32 000 Ft', wait: '1 nap', waitTier: 'old' as const, fulfill: 'none' as const, label: 'Hiány' },
  { bolti: 'Shoprenter · B2B', customer: 'Szabó Anna', amount: '5 990 Ft', wait: '25 perc', waitTier: 'fresh' as const, fulfill: 'unknown' as const, label: 'Ellenőrzés' },
]

function rowBgClass(fulfill: (typeof bufferRows)[0]['fulfill']) {
  if (fulfill === 'all') return 'bg-[rgba(232,245,233,0.45)]'
  if (fulfill === 'partial') return 'bg-[rgba(255,243,224,0.55)]'
  if (fulfill === 'none') return 'bg-[rgba(255,235,238,0.45)]'
  return 'bg-[rgba(250,250,250,0.9)]'
}

function waitChipClass(tier: (typeof bufferRows)[0]['waitTier']) {
  if (tier === 'fresh')
    return 'bg-[rgba(46,125,50,0.12)] text-[#2e7d32] border-[rgba(46,125,50,0.35)]'
  if (tier === 'medium')
    return 'bg-[rgba(239,108,0,0.12)] text-[#e65100] border-[rgba(239,108,0,0.35)]'
  return 'bg-[rgba(198,40,40,0.12)] text-[#c62828] border-[rgba(198,40,40,0.35)]'
}

function fulfillPillClass(fulfill: (typeof bufferRows)[0]['fulfill']) {
  if (fulfill === 'all') return 'bg-[#e8f5e9] text-[#1b5e20] border-[#a5d6a7]'
  if (fulfill === 'partial') return 'bg-[#fff8e1] text-[#e65100] border-[#ffcc80]'
  if (fulfill === 'none') return 'bg-[#ffebee] text-[#b71c1c] border-[#ef9a9a]'
  return 'bg-[#fafafa] text-[#616161] border-[rgba(0,0,0,0.12)]'
}

/** Segments: optional `h` = emphasize (competitor punch / benefit) */
const headlineRows: { t: string; h?: boolean }[][] = [
  [
    { t: 'Nincs több ' },
    { t: 'milliós bevezetési költség', h: true },
    { t: '.' },
  ],
  [
    { t: 'Nincs ' },
    { t: 'helyszíni szerver', h: true },
    { t: ', minden a ' },
    { t: 'felhőből', h: true },
    { t: ' megy.' },
  ],
  [
    { t: 'Bármennyi felhasználó', h: true },
    { t: ', ' },
    { t: 'ugyanazért az árért', h: true },
    { t: '.' },
  ],
  [
    { t: 'Nem kell tréning', h: true },
    { t: ' a használathoz.' },
  ],
]

const punchline = 'És mégis működik.'

const hl =
  'text-orange-400 font-extrabold [text-shadow:0_0_24px_rgba(251,146,60,0.35)]'

export default function Hero() {
  return (
    <section
      id="home"
      className="relative w-full overflow-hidden pt-14 pb-12 sm:pt-16 sm:pb-16"
      style={{
        background:
          'linear-gradient(145deg, #2c1810 0%, #1a120c 45%, #23160e 100%)',
      }}
    >
      {/* Warm dot grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,237,213,0.09) 1px, transparent 0)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Center wash — lifts the mid-tone */}
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[min(90vw,720px)] w-[min(90vw,720px)] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(251,146,60,0.10) 0%, transparent 68%)' }} />
      {/* Amber glow — top-left */}
      <div aria-hidden className="pointer-events-none absolute -top-32 -left-32 h-[560px] w-[560px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(251,146,60,0.32) 0%, transparent 65%)' }} />
      {/* Gold glow — bottom-right */}
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-24 h-[420px] w-[420px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(217,119,6,0.22) 0%, transparent 65%)' }} />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:gap-14">

          {/* ── Left — headlines + CTA (below mockup on mobile) ─ */}
          <div className="order-2 lg:order-1 flex-1 flex flex-col gap-10">

            <div className="flex flex-col gap-6 sm:gap-7 border-l-2 border-orange-500/40 pl-5 sm:pl-6">
              {headlineRows.map((row, ri) => (
                <p
                  key={ri}
                  className="text-2xl sm:text-3xl lg:text-[2rem] font-bold leading-snug tracking-tight"
                  style={{ color: '#fffbf5' }}
                >
                  {row.map((seg, si) =>
                    seg.h ? (
                      <span key={si} className={hl}>
                        {seg.t}
                      </span>
                    ) : (
                      <span key={si}>{seg.t}</span>
                    ),
                  )}
                </p>
              ))}

              {/* Punchline — solid color + glow (no text clip artifacts) */}
              <p
                className="text-3xl sm:text-4xl lg:text-[2.75rem] font-extrabold leading-snug tracking-tight text-amber-200 mt-2 sm:mt-3 inline-block pb-1"
                style={{
                  textShadow:
                    '0 0 40px rgba(251,146,60,0.45), 0 0 80px rgba(251,146,60,0.2), 0 2px 0 rgba(0,0,0,0.15)',
                }}
              >
                {punchline}
              </p>
            </div>

            <a
              href="#demo"
              className="inline-flex w-fit items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-orange-500 rounded-xl hover:bg-orange-600 active:bg-orange-700 transition-colors duration-150"
              style={{ boxShadow: '0 0 28px rgba(251,146,60,0.45)' }}
            >
              Foglalj 20 perces bemutatót
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </a>

          </div>

          {/* ── Right — live order mockup (first on mobile) ───── */}
          <div className="order-1 lg:order-2 flex-1 mb-8 lg:mb-0 flex justify-center lg:justify-end">
            <div className="relative w-full max-w-[560px]">

              {/* Browser frame */}
              <div
                className="rounded-2xl overflow-hidden bg-white"
                style={{
                  border: '1px solid rgba(251,146,60,0.25)',
                  boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 40px rgba(251,146,60,0.12)',
                }}
              >

                {/* Chrome bar */}
                <div className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                  <span className="w-3 h-3 rounded-full bg-red-300" />
                  <span className="w-3 h-3 rounded-full bg-yellow-300" />
                  <span className="w-3 h-3 rounded-full bg-green-300" />
                  <div className="ml-3 flex items-center px-3 h-5 rounded-md bg-white border border-slate-200 text-[10px] text-slate-500 min-w-0 flex-1 max-w-[min(100%,280px)] truncate">
                    mintawebshop.hu/orders/buffer
                  </div>
                </div>

                {/* Breadcrumbs + page title (matches buffer page) */}
                <div className="px-4 pt-3 pb-2 border-b border-black/[0.08] bg-white">
                  <p className="text-[10px] text-slate-500 mb-1">
                    <span className="text-slate-400">Rendelések</span>
                    <span className="mx-1 text-slate-300">/</span>
                    <span className="text-slate-700 font-medium">Rendelés puffer</span>
                  </p>
                  <p className="text-[11px] font-semibold text-slate-800">Beérkező rendelések — készletellenőrzés</p>
                </div>

                {/* Teljesíthetőség filter strip (simplified MUI-style) */}
                <div className="px-4 py-2 border-b border-black/[0.08] bg-white flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-slate-500 mr-0.5">Teljesíthetőség:</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#1976d2] text-white shadow-sm">Mind</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium text-slate-600 border border-black/[0.12] bg-white">Raktáron</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium text-slate-600 border border-black/[0.12] bg-white">Részben</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium text-slate-600 border border-black/[0.12] bg-white">Hiány</span>
                </div>

                {/* MUI-like table container */}
                <div className="bg-[#fafbfc] border-t border-black/[0.08] overflow-x-auto">
                  <table className="w-full min-w-[420px] text-left border-collapse">
                    <thead>
                      <tr className="bg-black/[0.04] border-b border-black/[0.08]">
                        {['Bolti', 'Vásárló', 'Összeg', 'Várakozás', 'Teljesíthetőség', 'Műveletek'].map((h, i) => (
                          <th
                            key={h}
                            className={`py-2 px-2 text-[10px] font-semibold text-slate-600 ${i === 5 ? 'text-right pr-3 w-[76px]' : ''}`}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {bufferRows.map((row, idx) => (
                        <tr key={idx} className={`border-b border-black/[0.08] ${rowBgClass(row.fulfill)}`}>
                          <td className="py-1.5 px-2 text-[11px] font-medium text-slate-800 max-w-[100px] truncate">{row.bolti}</td>
                          <td className="py-1.5 px-2 text-[11px] font-medium text-[#1976d2] truncate max-w-[90px]">{row.customer}</td>
                          <td className="py-1.5 px-2 text-[11px] text-slate-800 whitespace-nowrap">{row.amount}</td>
                          <td className="py-1.5 px-2 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium border ${waitChipClass(row.waitTier)}`}
                            >
                              <svg className="w-3 h-3 opacity-90" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                              </svg>
                              {row.wait}
                            </span>
                          </td>
                          <td className="py-1.5 px-2 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-semibold border ${fulfillPillClass(row.fulfill)}`}
                            >
                              {row.fulfill === 'all' && (
                                <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                                </svg>
                              )}
                              {row.fulfill === 'partial' && (
                                <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                                  <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
                                </svg>
                              )}
                              {row.fulfill === 'none' && (
                                <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                                </svg>
                              )}
                              {row.fulfill === 'unknown' && (
                                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                </svg>
                              )}
                              {row.label}
                            </span>
                          </td>
                          <td className="py-1.5 px-2 text-right">
                            <span className="inline-block px-2 py-0.5 text-[10px] font-semibold text-[#1976d2] border border-[rgba(25,118,210,0.45)] rounded bg-white">
                              Feldolgozás
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="px-4 py-2 bg-[#fafbfc] border-t border-black/[0.08]">
                  <p className="text-[10px] text-slate-500">Webshop rendelések a pufferben — készlet szerint színezve</p>
                </div>
              </div>

              {/* Floating — puffer story */}
              <div className="absolute -top-4 -right-4 bg-white rounded-xl border border-slate-200 shadow-md px-3 py-2 flex items-center gap-2.5 max-w-[200px]">
                <span className="w-7 h-7 rounded-lg bg-[#e8f5e9] flex items-center justify-center flex-shrink-0">
                  <svg className="w-3.5 h-3.5 text-[#2e7d32]" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                </span>
                <div>
                  <p className="text-xs font-semibold text-slate-800 leading-tight">Raktáron?</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Feldolgozás egy kattintással</p>
                </div>
              </div>

              <div className="absolute -bottom-4 -left-4 bg-white rounded-xl border border-slate-200 shadow-md px-3 py-2 flex items-center gap-2.5 max-w-[220px]">
                <span className="w-7 h-7 rounded-lg bg-[#fff8e1] flex items-center justify-center flex-shrink-0">
                  <svg className="w-3.5 h-3.5 text-[#e65100]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                </span>
                <div>
                  <p className="text-xs font-semibold text-slate-800 leading-tight">Várakozás látható</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Perc, óra vagy nap — soronként</p>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
