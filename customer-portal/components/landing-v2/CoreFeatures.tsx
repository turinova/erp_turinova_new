import PosTerminalMock from './PosTerminalMock'

/** Aligns with shop-portal `/orders` — OrdersTable columns + getFulfillabilityDisplayStyle palette */
const ordersPageMockRows = [
  {
    orderNumber: 'R-2025-1042',
    customer: 'Kovács Péter',
    source: 'webshop' as const,
    gross: '14 900 Ft',
    payment: 'Fizetve',
    mode: 'fulfill' as const,
    fulfill: 'Csomagolható' as const,
  },
  {
    orderNumber: 'R-2025-1043',
    customer: 'Nagy Eszter',
    source: 'webshop' as const,
    gross: '8 490 Ft',
    payment: 'Függőben',
    mode: 'fulfill' as const,
    fulfill: 'Hiány' as const,
  },
  {
    orderNumber: 'R-2025-1044',
    customer: 'Tóth Gábor',
    source: 'webshop' as const,
    gross: '32 000 Ft',
    payment: 'Fizetve',
    mode: 'fulfill' as const,
    fulfill: 'Beszerzés alatt' as const,
  },
  {
    orderNumber: 'R-2025-1038',
    customer: 'Horváth Béla',
    source: 'local' as const,
    gross: '21 500 Ft',
    payment: 'Fizetve',
    mode: 'status' as const,
    statusLabel: 'Begyűjtés',
  },
]

function ordersMockRowBg(
  row: (typeof ordersPageMockRows)[number],
): string {
  if (row.mode !== 'fulfill') return ''
  if (row.fulfill === 'Csomagolható') return 'bg-[rgba(232,245,233,0.45)]'
  if (row.fulfill === 'Hiány') return 'bg-[rgba(255,235,238,0.45)]'
  if (row.fulfill === 'Beszerzés alatt') return 'bg-[rgba(227,242,253,0.5)]'
  return ''
}

function ordersMockFulfillPillClass(f: 'Csomagolható' | 'Hiány' | 'Beszerzés alatt') {
  if (f === 'Csomagolható') return 'bg-[#e8f5e9] text-[#1b5e20] border-[#a5d6a7]'
  if (f === 'Hiány') return 'bg-[#ffebee] text-[#b71c1c] border-[#ef9a9a]'
  return 'bg-[#e3f2fd] text-[#1565c0] border-[#90caf9]'
}

/** Mirrors shop-portal `/pack/orders/[id]` — PackOrderPage table row tints */
const packOrderMockLines = [
  {
    name: 'Játékmackó · plüss',
    sku: 'JTK-MACKO-01',
    qty: 2,
    scanned: 1,
    imageSrc: '/banner/teddy.jpg',
    imageAlt: 'Játékmackó termékkép — Turinova csomagolás ellenőrzés',
  },
  {
    name: 'Puzzle 1000 db',
    sku: 'PZ-1000-GR',
    qty: 1,
    scanned: 0,
    imageSrc: '/banner/puzlle.jpeg',
    imageAlt: 'Puzzle termékkép — Turinova csomagolás ellenőrzés',
  },
  {
    name: 'LEGO Creator 3in1',
    sku: 'LG-31145',
    qty: 2,
    scanned: 2,
    imageSrc: '/banner/lego.jpg',
    imageAlt: 'LEGO Creator termékkép — Turinova csomagolás ellenőrzés',
  },
] as const

const packOrderMockTotalQty = packOrderMockLines.reduce((s, l) => s + l.qty, 0)
const packOrderMockScannedSum = packOrderMockLines.reduce((s, l) => s + l.scanned, 0)
const packOrderMockProgressPct =
  packOrderMockTotalQty > 0 ? Math.round((packOrderMockScannedSum / packOrderMockTotalQty) * 100) : 0

export default function CoreFeatures() {
  return (
    <section id="funkciok" className="bg-slate-50 py-14 scroll-mt-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-12">
          <span className="inline-flex items-center gap-2 rounded-full border border-orange-200/60 bg-white/90 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-orange-600 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
            </span>
            Webshop ERP · Automatizálás · Növekedés
          </span>

          <h2 className="mt-5 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 leading-tight">
            Minden, ami egy webshophoz kell —
            <br className="hidden sm:block" />
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(90deg, #ea580c 0%, #d97706 100%)' }}
            >
              {' '}egy helyen, automatikusan.
            </span>
          </h2>

          <p className="mt-4 text-slate-500 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            Miközben a konkurenseid exceles listákból dolgoznak, a Turinova elvégzi helyetted a napi rutin{' '}
            <strong className="text-slate-700">80%-át.</strong>
          </p>

          {/* Proof pills */}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {[
              { icon: '⏱', text: 'Napi 2–3 óra megtakarítás' },
              { icon: '🚫', text: 'Nincs több duplikált adat' },
              { icon: '📦', text: '3× több rendelés, ugyanannyi ember' },
            ].map(s => (
              <span key={s.text} className="inline-flex items-center gap-2 rounded-full bg-white border border-slate-200 px-4 py-1.5 text-[12px] font-medium text-slate-700 shadow-sm">
                <span>{s.icon}</span>
                {s.text}
              </span>
            ))}
          </div>
        </div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Card 1: Rendeléskezelés — large left */}
          <div className="lg:col-span-7 overflow-hidden rounded-3xl border border-indigo-100/80 bg-gradient-to-br from-white via-indigo-50/30 to-blue-50/20 shadow-sm">
            <div className="p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-indigo-600 text-white shadow-sm shadow-indigo-200">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                  Multi-Webshop Rendeléskezelés
                </span>
                <span className="text-[12px] text-slate-400">Shoprenter, UNAS és más · Auto + manuális</span>
              </div>

              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug">
                Megérkezett a rendelés. A Turinova már kezeli is — és azonnal tudod, mi a következő lépés.
              </h3>
              <p className="mt-3 text-slate-500 text-sm leading-relaxed">
                Nem csak szinkronizálja a rendeléseket — azonnal szétválogatja is. Egy pillantással látod,{' '}
                <strong className="text-slate-700">melyik rendelés teljesíthető azonnal</strong>, és melyikhez
                kell előbb beszerzést indítani. A díjbekérő kiküldi, a készletet leveszi.
                Reggel 5 perc, és tudod a nap teendőit.
              </p>

              {/* Feature rows — larger, readable */}
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    icon: (
                      <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                      </svg>
                    ),
                    title: 'Auto + manuális szinkron',
                    sub: 'Shoprenter, UNAS és más webshopok',
                  },
                  {
                    icon: (
                      <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                      </svg>
                    ),
                    title: 'Díjbekérő automatikusan',
                    sub: 'Rendelés után azonnal kiküldi',
                  },
                  {
                    icon: (
                      <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
                      </svg>
                    ),
                    title: 'Készlet real-time frissül',
                    sub: 'Rendelés után azonnal levon',
                  },
                  {
                    icon: (
                      <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
                      </svg>
                    ),
                    title: 'Azonnal látod: mi kész, mi nem',
                    sub: 'Feldolgozható vs. Beszerzés szükséges',
                  },
                ].map(f => (
                  <div key={f.title} className="flex items-start gap-3 rounded-2xl border border-indigo-100 bg-white px-4 py-3">
                    <div className="mt-0.5 flex-shrink-0 w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                      {f.icon}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{f.title}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{f.sub}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* /orders page mock — shop-portal OrdersPageClient + OrdersTable */}
              <div className="mt-6 rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm text-left">
                <div className="px-3 sm:px-4 pt-3 pb-2 border-b border-slate-100">
                  <p className="text-[10px] text-slate-500 mb-2">
                    <span className="text-slate-400">Főoldal</span>
                    <span className="mx-1 text-slate-300">/</span>
                    <span className="text-slate-700 font-medium">Rendelések</span>
                  </p>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Rendelések</p>
                      <p className="text-[10px] text-slate-500 leading-snug max-w-md mt-0.5 hidden sm:block">
                        Webshop és egyéb források — szűrés, tömeges műveletek. A pufferből feldolgozva kerülnek ide.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 shrink-0">
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-semibold bg-[#1976d2] text-white shadow-sm">
                        Új rendelés
                      </span>
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-semibold text-[#1976d2] border border-[rgba(25,118,210,0.5)] bg-white">
                        Rendelés puffer →
                      </span>
                    </div>
                  </div>
                </div>

                <div className="px-3 sm:px-4 py-2 bg-slate-50 border-b border-slate-200">
                  <p className="text-[9px] font-semibold text-slate-500 tracking-wider mb-1.5">SZŰRŐK</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 bg-white text-[10px] text-slate-600">
                      Státusz: <strong className="text-slate-800">Összes</strong>
                    </span>
                    <span className="inline-flex items-center px-2 py-1 rounded border border-slate-200 bg-white text-[10px] text-slate-400 min-w-[120px]">
                      Keresés…
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto border-b border-slate-200">
                  <table className="w-full min-w-[520px] text-left border-collapse text-[10px] sm:text-[11px]">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="py-2 pl-3 pr-1 w-8 font-semibold text-slate-600">
                          <span className="inline-block w-3 h-3 rounded border border-slate-300 bg-white" aria-hidden />
                        </th>
                        <th className="py-2 px-1 font-semibold text-slate-600 whitespace-nowrap">Rendelésszám</th>
                        <th className="py-2 px-1 font-semibold text-slate-600">Vásárló</th>
                        <th className="py-2 px-1 font-semibold text-slate-600">Forrás</th>
                        <th className="py-2 px-1 font-semibold text-slate-600 whitespace-nowrap">Bruttó</th>
                        <th className="py-2 px-1 font-semibold text-slate-600">Státusz</th>
                        <th className="py-2 pr-3 pl-1 font-semibold text-slate-600 whitespace-nowrap">Fizetés</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ordersPageMockRows.map(row => (
                        <tr
                          key={row.orderNumber}
                          className={`border-b border-slate-100 ${ordersMockRowBg(row)} hover:opacity-[0.97]`}
                        >
                          <td className="py-1.5 pl-3 pr-1 align-middle">
                            <span className="inline-block w-3 h-3 rounded border border-slate-300 bg-white" aria-hidden />
                          </td>
                          <td className="py-1.5 px-1 align-middle whitespace-nowrap">
                            <span className="font-medium text-[#1976d2]">{row.orderNumber}</span>
                          </td>
                          <td className="py-1.5 px-1 align-middle text-slate-800 font-medium truncate max-w-[100px] sm:max-w-[120px]">
                            {row.customer}
                          </td>
                          <td className="py-1.5 px-1 align-middle whitespace-nowrap">
                            {row.source === 'webshop' ? (
                              <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium border bg-[rgba(25,118,210,0.12)] text-[#1565c0] border-[rgba(25,118,210,0.35)]">
                                Webshop
                              </span>
                            ) : (
                              <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium border bg-black/[0.04] text-slate-600 border-black/[0.12]">
                                Helyi
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 px-1 align-middle text-slate-800 whitespace-nowrap">{row.gross}</td>
                          <td className="py-1.5 px-1 align-middle whitespace-nowrap">
                            {row.mode === 'fulfill' ? (
                              <span
                                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-semibold border ${ordersMockFulfillPillClass(row.fulfill)}`}
                              >
                                {row.fulfill === 'Csomagolható' && (
                                  <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                                  </svg>
                                )}
                                {row.fulfill === 'Hiány' && (
                                  <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                                  </svg>
                                )}
                                {row.fulfill === 'Beszerzés alatt' && (
                                  <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                                    <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM5 18c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm14.65-11.73l1.41 1.41-4.24 4.25c-.2.2-.51.2-.71 0l-2.12-2.12 1.41-1.41 1.41 1.42 3.54-3.55zM17 18c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" />
                                  </svg>
                                )}
                                {row.fulfill}
                              </span>
                            ) : (
                              <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium border border-[rgba(25,118,210,0.55)] text-[#1976d2] bg-white">
                                {row.statusLabel}
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 pr-3 pl-1 align-middle whitespace-nowrap">
                            {row.payment === 'Fizetve' ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-semibold border bg-[#E8F5E9] text-[#1B5E20] border-[#A5D6A7]">
                                <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                                  <path d="M18 7l-1.41-1.41-6.34 6.34-1.59-1.59L7 12l4 4 8-8z" />
                                </svg>
                                Fizetve
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-semibold border bg-[#FFF8E1] text-[#7A5D00] border-[#FFE082]">
                                <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                                  <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
                                </svg>
                                Függőben
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="px-3 sm:px-4 py-2 bg-slate-50 border-t border-slate-100">
                  <p className="text-[10px] text-slate-500">
                    Mint a <span className="font-medium text-slate-600">rendelések listanézetén</span> (illusztráció): új rendelésnél{' '}
                    <span className="text-emerald-700 font-medium">Csomagolható</span> /{' '}
                    <span className="text-red-800 font-medium">Hiány</span> /{' '}
                    <span className="text-blue-800 font-medium">Beszerzés alatt</span>.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Szállítás — right */}
          <div className="lg:col-span-5 overflow-hidden rounded-3xl border border-orange-100/80 bg-gradient-to-br from-white via-orange-50/30 to-amber-50/20 shadow-sm">
            <div className="p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-orange-500 text-white shadow-sm shadow-orange-200">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                  </svg>
                  Kiszállítás &amp; Bolti Átvétel
                </span>
              </div>

              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug">
                Csomagcímke egy kattintással, értesítők automatikusan — akárhogy szállítasz.
              </h3>
              <p className="mt-3 text-slate-500 text-sm leading-relaxed">
                Akár futárral küldesz, akár bolti átvételt kínálsz — a Turinova mindkettőt automatikusan kezeli.
                Csomagolás után <strong className="text-slate-700">azonnal nyomtatható a csomagcímke</strong>,
                a tracking visszaíródik, és ha a vevő nem veszi át a csomagját,{' '}
                <strong className="text-slate-700">az emlékeztető is automatikusan kimegy.</strong>
              </p>

              {/* Two delivery modes */}
              <div className="mt-5 grid grid-cols-2 gap-3">
                {/* Courier */}
                <div className="rounded-2xl border border-orange-200/70 bg-orange-50/40 p-3.5">
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-orange-100">
                      <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                      </svg>
                    </span>
                    <p className="text-[11px] font-bold text-orange-700 uppercase tracking-wide">Futárral</p>
                  </div>
                  <div className="space-y-1.5">
                    {['Csomagcímke azonnal nyomtatható', 'Nyomkövetési szám automatikusan mentve', 'Vevő emailt kap a nyomkövetési linkkel'].map(t => (
                      <div key={t} className="flex items-start gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0 mt-1" />
                        <p className="text-[11px] text-slate-600 leading-snug">{t}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Store pickup */}
                <div className="rounded-2xl border border-indigo-200/70 bg-indigo-50/40 p-3.5">
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-100">
                      <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" />
                      </svg>
                    </span>
                    <p className="text-[11px] font-bold text-indigo-700 uppercase tracking-wide">Bolti átvétel</p>
                  </div>
                  <div className="space-y-1.5">
                    {['Automatikus email értesítő küldés átvételről', 'Emlékeztető email, ha a vevő nem veszi át', 'Jelzés lejárt átvétel esetén'].map(t => (
                      <div key={t} className="flex items-start gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0 mt-1" />
                        <p className="text-[11px] text-slate-600 leading-snug">{t}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Carrier logos */}
              <div className="mt-5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Integrált futárszolgálatok</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { src: '/Logo/Express_One_Hungary_idxX3CYt_m_1.svg', alt: 'ExpressOne futárszolgálat automatikus csomagcímke generálás Turinova webshop ERP', h: 'h-6' },
                    { src: '/Logo/hirlevel_header_foxpost_logo.png', alt: 'FOXPOST integráció automatikus szállítás webshop ERP rendszer Turinova', h: 'h-6' },
                    { src: '/Logo/mp150_logo_fb.jpg', alt: 'MPL Magyar Posta futárszolgálat integráció Turinova ERP webshop rendeléskezelés', h: 'h-7' },
                    { src: '/Logo/Vilagos_hatterre_Logo_Sameday.png.webp', alt: 'Sameday futárszolgálat integráció Turinova webshop ERP csomagcímke', h: 'h-6' },
                    { src: '/Logo/gls-logo.png', alt: 'GLS futárszolgálat integráció Turinova webshop ERP automatikus szállítás', h: 'h-6' },
                    { src: '/Logo/DPD_logo_(2015).svg.png', alt: 'DPD futárszolgálat integráció Turinova webshop ERP csomagcímke', h: 'h-6' },
                    { src: '/Logo/DHL_Logo.svg.png', alt: 'DHL futárszolgálat integráció Turinova ERP automatikus szállítás', h: 'h-5' },
                    { src: '/Logo/Logo_Packeta_s.r.o..png', alt: 'Packeta Z-BOX integráció Turinova webshop ERP', h: 'h-6' },
                  ].map(c => (
                    <div key={c.src} className="flex items-center justify-center rounded-xl border border-slate-200 bg-white px-2 py-2 h-11">
                      <img src={c.src} alt={c.alt} className={`${c.h} w-auto max-w-full object-contain`} loading="lazy" decoding="async" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Számlázás + POS */}
          <div className="lg:col-span-5 overflow-hidden rounded-3xl border border-emerald-100/80 bg-gradient-to-br from-white via-emerald-50/30 to-teal-50/20 shadow-sm">
            <div className="p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-emerald-600 text-white shadow-sm shadow-emerald-200">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                  Számlázás Integráció
                </span>
                <span className="text-[12px] text-slate-400">Számlázz.hu · Billingo hamarosan</span>
              </div>

              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug">
                Díjbekérőtől a stornóig — minden számla ott van, ahol a rendelés.
              </h3>
              <p className="mt-3 text-slate-500 text-sm leading-relaxed">
                Elég volt a számlázóba oda-vissza kattintgatásból. A díjbekérő automatikusan kimegy, a számla
                — akár manuálisan, akár automatikusan — egy kattintással kiállítható. Előlegszámla? Stornó?
                Mind elérhető. És a legfontosabb:{' '}
                <strong className="text-slate-700">minden rendelésnél ott látod az összes hozzá tartozó pénzügyi dokumentumot</strong>{' '}
                — nem kell keresgélni.
              </p>

              {/* Feature rows */}
              <div className="mt-5 grid grid-cols-2 gap-2.5">
                {[
                  {
                    icon: (
                      <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                      </svg>
                    ),
                    title: 'Díjbekérő automatikusan',
                    sub: 'Rendelés után azonnal kiküldi',
                  },
                  {
                    icon: (
                      <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                      </svg>
                    ),
                    title: 'Számla 1 kattintással',
                    sub: 'Manuálisan vagy automatikusan',
                  },
                  {
                    icon: (
                      <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                      </svg>
                    ),
                    title: 'Előlegszámla & stornó',
                    sub: 'Teljes pénzügyi életciklus',
                  },
                  {
                    icon: (
                      <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                      </svg>
                    ),
                    title: 'Rendelésenként nyomon követve',
                    sub: 'Minden számla a rendelésnél tárolva',
                  },
                ].map(f => (
                  <div key={f.title} className="flex items-start gap-2.5 rounded-2xl border border-emerald-100 bg-white px-3.5 py-3">
                    <div className="mt-0.5 flex-shrink-0 w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                      {f.icon}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 leading-tight">{f.title}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{f.sub}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Invoice timeline mock */}
              <div className="mt-5 rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <span className="text-[11px] font-bold text-slate-700">Rendelés #1042 · Kovács Péter</span>
                  <span className="text-[10px] text-slate-400">Pénzügyi dokumentumok</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {[
                    { icon: '📤', label: 'Díjbekérő', status: 'Kiküldve', date: 'márc. 15.', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
                    { icon: '📄', label: 'Előlegszámla', status: 'Kiállítva', date: 'márc. 16.', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
                    { icon: '✅', label: 'Végszámla', status: 'Kiállítva', date: 'márc. 20.', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="text-sm">{row.icon}</span>
                        <span className="text-[12px] font-medium text-slate-700">{row.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400">{row.date}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${row.color}`}>
                          {row.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200">
                  <p className="text-[10px] text-slate-400">Tudod pontosan, hol tart minden rendelés pénzügyileg.</p>
                </div>
              </div>

              {/* Invoicing logos */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 h-16">
                  <img src="/Logo/szamlazzhu_logo-horizontal-1_color.png" alt="Számlázz.hu automatikus számlázás integráció webshop ERP Turinova" className="h-9 w-auto object-contain" loading="lazy" decoding="async" />
                </div>
                <div className="relative flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3 h-16">
                  <img src="/Logo/logo.png" alt="Billingo számlázó integráció Turinova ERP hamarosan" className="h-9 w-auto object-contain opacity-40" loading="lazy" decoding="async" />
                  <span className="absolute top-1.5 right-2 text-[9px] font-bold text-slate-400 uppercase tracking-wide">Hamarosan</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 4: POS */}
          <div className="lg:col-span-7 overflow-hidden rounded-3xl border border-orange-100/80 bg-gradient-to-br from-white via-orange-50/30 to-amber-50/20 shadow-sm flex flex-col">
            <div className="p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-orange-600 text-white shadow-sm shadow-orange-200">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
                  </svg>
                  Online + Bolti értékesítés
                </span>
                <span className="text-[12px] text-slate-400">POS kassza · Bolti rendelések · Valós idejű készlet</span>
              </div>

              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug">
                Bolti kassza, webshop rendelés —{' '}
                <span className="text-orange-600">mindkettő ugyanabból a rendszerből.</span>
              </h3>
              <p className="mt-3 text-slate-500 text-sm leading-relaxed">
                A Turinova POS kasszájával a bolti eladás is rendelésként kerül a rendszerbe — pontosan úgy, mint egy webshop megrendelés.{' '}
                <strong className="text-slate-700">Közös rendeléskezelő, közös készlet, azonnali számla a kasszánál. Minden eladás egy helyen, valós időben.</strong>
              </p>

              {/* Feature chips */}
              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  { icon: '🏪', label: 'Bolti eladás = rendelés a rendszerben' },
                  { icon: '⚡', label: 'Közös készlet, valós időben' },
                  { icon: '🧾', label: 'Azonnali számlázás kasszánál' },
                ].map(({ icon, label }) => (
                  <span key={label} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-[11px] font-semibold text-orange-700">
                    <span>{icon}</span>{label}
                  </span>
                ))}
              </div>

              {/* Proof pill */}
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white border border-orange-200 px-3.5 py-1.5 shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500" />
                </span>
                <span className="text-[11px] font-semibold text-slate-600">Webshop + bolt: egy rendeléskezelő, egy készlet</span>
              </div>
            </div>

            {/* POS terminal mock — main-app PosClient layout (marketing: +Kép oszlop) */}
            <div className="flex-1 mx-4 mb-4 sm:mx-6 sm:mb-6 min-h-[min(480px,72vh)]">
              <PosTerminalMock />
            </div>
          </div>

          {/* Card 5: Pick & Pack */}
          <div className="lg:col-span-12 overflow-hidden rounded-3xl border border-cyan-100/80 bg-gradient-to-br from-white via-cyan-50/30 to-sky-50/20 shadow-sm">
            <div className="p-6 sm:p-8">
              <div className="flex flex-col lg:flex-row lg:items-start gap-8">

                {/* Left: copy + workflow */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-cyan-600 text-white shadow-sm shadow-cyan-200">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75ZM6.75 16.5h.75v.75h-.75v-.75ZM16.5 6.75h.75v.75h-.75v-.75ZM13.5 13.5h.75v.75h-.75v-.75ZM13.5 19.5h.75v.75h-.75v-.75ZM19.5 13.5h.75v.75h-.75v-.75ZM19.5 19.5h.75v.75h-.75v-.75ZM16.5 16.5h.75v.75h-.75v-.75Z" />
                      </svg>
                      Raktári Picking &amp; Csomagolás
                    </span>
                    <span className="text-[12px] text-slate-400">PDA vonalkód-szkennelés · Hibamentes szedés · Gyors</span>
                  </div>

                  <h3 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug">
                    Rossz csomag?{' '}
                    <span className="text-cyan-600">PDA-val ez nem tud megtörténni.</span>
                  </h3>
                  <p className="mt-3 text-slate-500 text-sm leading-relaxed max-w-lg">
                    A raktáros tableten látja, mit kell szedni — képpel, darabszámmal. Beolvassa a vonalkódot,
                    a rendszer visszaigazol. Rossz terméknél azonnal piros jelzés. Csomagolásnál újra ellenőrzés,
                    mielőtt leragasztják a dobozt.{' '}
                    <strong className="text-slate-700">Ami kimegy az ajtón, az biztosan helyes.</strong>
                  </p>

                  {/* Feature chips */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {[
                      { icon: '🎯', label: 'Rossz vonalkód = azonnali jelzés' },
                      { icon: '⚡', label: 'Több rendelés, 1 raktárjárás' },
                      { icon: '📱', label: 'PDA-optimalizált felület' },
                      { icon: '🔢', label: 'Darabszám ellenőrzés tételenként' },
                    ].map(({ icon, label }) => (
                      <span key={label} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-50 border border-cyan-200 text-[11px] font-semibold text-cyan-700">
                        <span>{icon}</span>{label}
                      </span>
                    ))}
                  </div>

                  {/* Proof pill */}
                  <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white border border-cyan-200 px-3.5 py-1.5 shadow-sm">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500" />
                    </span>
                    <span className="text-[11px] font-semibold text-slate-600">Mindig tudod, hol tart minden rendelés</span>
                  </div>

                  {/* Workflow pipeline */}
                  <div className="mt-8 relative">
                    <div
                      aria-hidden
                      className="hidden sm:block absolute top-[22px] left-[22px] right-[22px] h-[2px] rounded-full"
                      style={{ background: 'linear-gradient(to right, #0891b2, #6366f1, #f59e0b, #10b981)' }}
                    />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 relative">
                      {[
                        {
                          num: '01', color: 'bg-cyan-500', shadow: 'shadow-cyan-200',
                          icon: (
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
                            </svg>
                          ),
                          label: 'Begyűjtés', sub: 'Rendelések csoportosítva, batch indítva',
                        },
                        {
                          num: '02', color: 'bg-indigo-500', shadow: 'shadow-indigo-200',
                          icon: (
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" />
                            </svg>
                          ),
                          label: 'Szedés (PDA)', sub: 'Vonalkód-szkennelés tételenként',
                        },
                        {
                          num: '03', color: 'bg-amber-500', shadow: 'shadow-amber-200',
                          icon: (
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                            </svg>
                          ),
                          label: 'Csomagolás', sub: 'Ellenőrzés és dobozba rakás',
                        },
                        {
                          num: '04', color: 'bg-emerald-500', shadow: 'shadow-emerald-200',
                          icon: (
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
                            </svg>
                          ),
                          label: 'Futárátadás', sub: 'Csomagcímke kész, futár átveszi',
                        },
                      ].map(step => (
                        <div key={step.num} className="flex flex-col items-center text-center gap-3">
                          <div className={`relative flex items-center justify-center w-11 h-11 rounded-full ${step.color} shadow-md ${step.shadow} z-10`}>
                            {step.icon}
                            <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-4 h-4 rounded-full bg-white border border-slate-200 text-[9px] font-black text-slate-600 leading-none">
                              {step.num}
                            </span>
                          </div>
                          <div>
                            <p className="text-[12px] font-bold text-slate-800 leading-tight">{step.label}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">{step.sub}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right: /pack/orders/[id] csomagolás-ellenőrzés mock (PackOrderPage) */}
                <div className="flex-1 min-w-0">
                  <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-md">
                    <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border-b border-slate-200">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-300" />
                      <span className="w-2.5 h-2.5 rounded-full bg-yellow-300" />
                      <span className="w-2.5 h-2.5 rounded-full bg-green-300" />
                      <div className="ml-2 flex-1 min-w-0 h-5 flex items-center px-2 rounded bg-white border border-slate-200 text-[9px] text-slate-500 truncate">
                        mintawebshop.hu/pack/orders/pelda-rendeles
                      </div>
                    </div>

                    <div className="p-3 sm:p-4 bg-slate-50/80">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="flex items-center justify-center w-8 h-8 rounded-full border border-slate-200 bg-white text-slate-500"
                          aria-hidden
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                          </svg>
                        </span>
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#1976d2] text-white">
                          R-2025-1042
                        </span>
                        <span className="text-[13px] font-semibold text-slate-900">Kovács Péter</span>
                        <span className="text-[11px] text-slate-500">GLS házhoz</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 ml-10 truncate">Budapest, 1024 · Fő utca 12.</p>

                      <div className="flex items-center gap-2 mt-3">
                        <div className="flex-1 h-2.5 rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#1976d2] transition-all"
                            style={{ width: `${packOrderMockProgressPct}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-bold text-slate-800 tabular-nums shrink-0">
                          {packOrderMockScannedSum} / {packOrderMockTotalQty} db
                        </span>
                      </div>
                    </div>

                    <div className="overflow-x-auto border-t border-slate-200">
                      <table className="w-full min-w-[480px] text-left text-[10px] sm:text-[11px] border-collapse">
                        <thead>
                          <tr className="bg-slate-100 border-b border-slate-200">
                            <th className="py-2 pl-3 pr-1 font-bold text-slate-700 w-14">Kép</th>
                            <th className="py-2 px-1 font-bold text-slate-700">Termék</th>
                            <th className="py-2 px-1 font-bold text-slate-700 whitespace-nowrap">Cikkszám</th>
                            <th className="py-2 px-1 font-bold text-slate-700 text-center w-12">Várt</th>
                            <th className="py-2 px-1 font-bold text-slate-700 text-center whitespace-nowrap">Beolvasva</th>
                            <th className="py-2 px-1 font-bold text-slate-700 text-center">±1</th>
                            <th className="py-2 pr-3 w-8" />
                          </tr>
                        </thead>
                        <tbody>
                          {packOrderMockLines.map(line => {
                            const done = line.scanned >= line.qty
                            return (
                              <tr
                                key={line.sku}
                                className={`border-b border-slate-100 ${done ? 'bg-[rgba(46,125,50,0.22)]' : 'bg-[rgba(211,47,47,0.12)]'}`}
                              >
                                <td className="py-1.5 pl-3 align-middle">
                                  <img
                                    src={line.imageSrc}
                                    alt={line.imageAlt}
                                    loading="lazy"
                                    decoding="async"
                                    className="w-10 h-10 sm:w-12 sm:h-12 rounded object-contain bg-slate-100 border border-slate-300"
                                  />
                                </td>
                                <td className="py-1.5 px-1 align-middle font-medium text-slate-800 max-w-[120px] sm:max-w-none truncate sm:whitespace-normal">
                                  {line.name}
                                </td>
                                <td className="py-1.5 px-1 align-middle text-slate-600 whitespace-nowrap">{line.sku}</td>
                                <td className="py-1.5 px-1 align-middle text-center font-semibold text-slate-900">{line.qty}</td>
                                <td className="py-1.5 px-1 align-middle text-center">
                                  <span className={`font-bold text-[11px] ${done ? 'text-emerald-700' : 'text-slate-900'}`}>
                                    {line.scanned} / {line.qty}
                                  </span>
                                </td>
                                <td className="py-1.5 px-1 align-middle">
                                  <div className="flex items-center justify-center gap-0.5">
                                    <span className="inline-flex items-center justify-center w-7 h-7 rounded border border-slate-300 bg-white text-slate-500">
                                      −
                                    </span>
                                    <span className="inline-flex items-center justify-center gap-0.5 px-1.5 h-7 rounded border border-slate-300 bg-white text-slate-600 font-medium">
                                      +1
                                    </span>
                                  </div>
                                </td>
                                <td className="py-1.5 pr-3 align-middle text-center">
                                  {done && (
                                    <svg className="w-5 h-5 text-emerald-600 mx-auto" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                                    </svg>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 py-2.5 bg-white border-t border-slate-200">
                      <p className="text-[10px] text-slate-500 leading-snug max-w-md">
                        Vonalkódolvasó vagy <strong className="text-slate-600">−1</strong> / <strong className="text-slate-600">+1</strong>
                        — piros sor = még nincs kész, zöld = kész.
                      </p>
                      <button
                        type="button"
                        disabled
                        className="shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-[11px] sm:text-xs font-bold bg-slate-300 text-slate-500 cursor-not-allowed"
                      >
                        <svg className="w-4 h-4 opacity-60" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                        </svg>
                        Csomag kész
                      </button>
                    </div>
                    <p className="px-3 pb-2 text-[9px] text-slate-400">
                      Mint a <span className="font-medium text-slate-500">Csomagolás</span> képernyőn: minden tétel beolvasva után aktiválódik a gomb.
                    </p>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Card 6: Értesítések & Riportok — full width */}
          <div className="lg:col-span-12 overflow-hidden rounded-3xl border border-rose-100/80 bg-gradient-to-br from-white via-rose-50/25 to-pink-50/20 shadow-sm">
            <div className="p-6 sm:p-8">
              <div className="flex flex-col lg:flex-row lg:items-start gap-8">
                {/* Left */}
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-rose-600 text-white shadow-sm shadow-rose-200">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                      </svg>
                      Automatikus + Átlátható
                    </span>
                    <span className="text-[12px] text-slate-400">Email értesítők · Riportok · Saját sablonok</span>
                  </div>

                  <h3 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug">
                    Mindig tudod, mi történik —<br className="hidden sm:block" /> anélkül, hogy bármit csinálnál érte.
                  </h3>
                  <p className="mt-3 text-slate-500 text-sm leading-relaxed max-w-lg">
                    A vevőd emailt kap, amikor elindul a csomag. Te dashboardot látsz arról, mi fogy, mi nem,
                    hol tart a bevétel. Saját email sablonok, automatikus státusz értesítők —{' '}
                    <strong className="text-slate-700">a rendszer kommunikál, te dönthetsz.</strong>
                  </p>

                  {/* 3 report types */}
                  <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { icon: '📈', title: 'Értékesítési riport', sub: 'Bevétel · Rendelések száma · Trend' },
                      { icon: '📦', title: 'Készlet riport', sub: 'Mi fogy · Mi áll · Újrarendelési jelzés' },
                      { icon: '👥', title: 'Vevői riport', sub: 'Legjobb vevők · Visszatérők · Átlag kosár' },
                    ].map(r => (
                      <div key={r.title} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-base">{r.icon}</span>
                          <p className="text-[11px] font-bold text-slate-800">{r.title}</p>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-snug">{r.sub}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: email notification mock */}
                <div className="flex-1 min-w-0">
                  <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                      </svg>
                      <span className="text-[11px] text-slate-500 font-medium">Automatikus vevő email értesítő (példa)</span>
                    </div>
                    <div className="p-5 space-y-3">
                      {[
                        { status: '🟢', label: 'Rendelés visszaigazolva', time: '10:24', color: 'text-emerald-600' },
                        { status: '🔵', label: 'Csomagod úton van — tracking link', time: '14:07', color: 'text-blue-600' },
                        { status: '✅', label: 'Csomag kézbesítve', time: 'Másnap 11:32', color: 'text-slate-700' },
                      ].map(e => (
                        <div key={e.label} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{e.status}</span>
                            <p className={`text-[12px] font-semibold ${e.color}`}>{e.label}</p>
                          </div>
                          <span className="text-[10px] text-slate-400">{e.time}</span>
                        </div>
                      ))}
                      <p className="text-[11px] text-slate-400 pt-1 text-center">Saját sablon · Saját márkaidentitás · Automatikusan</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Section CTA */}
        <div className="mt-10 text-center">
          <p className="text-sm text-slate-500">
            Ha napi 2–3 órát töltesz rendelésekkel, számlázással és csomagolással — ezt látni kell.
          </p>
          <a
            href="#demo"
            className="mt-4 inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-orange-500 rounded-xl hover:bg-orange-600 active:bg-orange-700 transition-colors duration-150 shadow-sm shadow-orange-200"
          >
            Kérek személyes bemutatót
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </a>
        </div>

      </div>
    </section>
  )
}
