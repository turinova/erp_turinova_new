import type { SolutionMockKind } from './solutions-data'

function Chrome({
  url,
  borderColor,
  children,
}: {
  url: string
  borderColor: string
  children: React.ReactNode
}) {
  return (
    <div
      className="rounded-2xl overflow-hidden bg-white shadow-xl shadow-slate-300/40"
      style={{ border: `1px solid ${borderColor}` }}
    >
      <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border-b border-slate-200">
        <span className="w-2.5 h-2.5 rounded-full bg-red-300" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-300" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-300" />
        <div className="ml-2 flex-1 min-w-0 h-5 rounded-md bg-white border border-slate-200 px-2 text-[10px] text-slate-500 truncate flex items-center">
          {url}
        </div>
      </div>
      {children}
    </div>
  )
}

function FloatChip({
  className,
  title,
  subtitle,
  icon,
}: {
  className: string
  title: string
  subtitle: string
  icon: React.ReactNode
}) {
  return (
    <div
      className={`absolute z-10 bg-white rounded-xl border border-slate-200 shadow-md px-2.5 py-2 flex items-center gap-2 max-w-[190px] ${className}`}
    >
      <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-slate-800 leading-tight">{title}</p>
        <p className="text-[9px] text-slate-500 mt-0.5 leading-snug">{subtitle}</p>
      </div>
    </div>
  )
}

/* ── B2B: partnerárak (/arak) ─────────────────────────────── */

const b2bPriceRows = [
  {
    sku: 'AL-250',
    name: 'Alu profil 250 mm',
    list: '4 200 Ft',
    partner: '3 696 Ft',
    source: 'csoport −12%',
    sourceOk: true,
    tier: '2 sáv',
  },
  {
    sku: 'CS-18W',
    name: 'Bútorlap 18 mm fehér',
    list: '8 900 Ft',
    partner: '7 500 Ft',
    source: 'fix Ft',
    sourceOk: true,
    tier: '-',
  },
  {
    sku: 'CS-CSAV',
    name: 'Confirmat csavar 7×50',
    list: '18 Ft',
    partner: '15 Ft',
    source: 'csoport −12%',
    sourceOk: true,
    tier: '3 sáv',
  },
  {
    sku: 'GL-URED',
    name: 'Üvegajtó fogantyú',
    list: '2 450 Ft',
    partner: '2 450 Ft',
    source: 'lista',
    sourceOk: false,
    tier: '-',
  },
]

function B2bPricingMock({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'relative w-full' : 'relative w-full pt-3 pr-2 pb-4 pl-1'}>
      {!compact && (
      <FloatChip
        className="-top-1 -right-1 sm:right-0"
        title="Widget élő"
        subtitle="Gyors rendelés a bolton"
        icon={
          <span className="w-full h-full rounded-lg bg-teal-100 flex items-center justify-center">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-600" />
            </span>
          </span>
        }
      />
      )}
      <Chrome url="b2b.turinova.hu/arak" borderColor="rgba(13,148,136,0.4)">
        <div className="px-3 pt-2.5 pb-2 border-b border-black/[0.08] bg-white flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[9px] text-slate-500">Partnerárak / Árazás</p>
            <p className="text-[11px] font-semibold text-slate-800">Viszonteladó A</p>
          </div>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold border border-teal-200 bg-teal-50 text-teal-800">
            lista −12%
          </span>
        </div>

        <div className="px-3 py-1.5 border-b border-black/[0.08] bg-white flex items-center gap-1">
          <span className="px-2 py-0.5 rounded text-[9px] font-semibold bg-teal-700 text-white">Szabály</span>
          <span className="px-2 py-0.5 rounded text-[9px] font-medium text-slate-600 border border-black/[0.1] bg-white">
            Kivételek
          </span>
          <span className="px-2 py-0.5 rounded text-[9px] font-medium text-slate-600 border border-black/[0.1] bg-white">
            Sávok
          </span>
        </div>

        <div className="px-3 py-1.5 border-b border-teal-100 bg-teal-50/60 text-[9px] text-teal-900">
          Viszonteladó A: lista −12%. <span className="font-semibold">3 fix</span>. Sávok a Sávok fülön.
        </div>

        <div className="bg-[#fafbfc] overflow-x-auto">
          <table className="w-full min-w-[420px] text-left border-collapse">
            <thead>
              <tr className="bg-black/[0.04] border-b border-black/[0.08]">
                {['SKU', 'Termék', 'Lista', 'Partner', 'Forrás', 'Sáv'].map(h => (
                  <th key={h} className="py-1.5 px-1.5 text-[9px] font-semibold text-slate-600">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b2bPriceRows.map(row => (
                <tr key={row.sku} className="border-b border-black/[0.06] bg-white">
                  <td className="py-1.5 px-1.5 text-[10px] font-mono font-semibold text-slate-800 whitespace-nowrap">
                    {row.sku}
                  </td>
                  <td className="py-1.5 px-1.5 text-[10px] text-slate-700 truncate max-w-[110px]">{row.name}</td>
                  <td className="py-1.5 px-1.5 text-[10px] text-slate-500 whitespace-nowrap">{row.list}</td>
                  <td className="py-1.5 px-1.5 text-[10px] font-bold text-teal-800 whitespace-nowrap">{row.partner}</td>
                  <td className="py-1.5 px-1.5 whitespace-nowrap">
                    <span
                      className={[
                        'inline-flex px-1.5 py-0.5 rounded text-[9px] font-semibold border',
                        row.sourceOk
                          ? 'bg-teal-50 text-teal-800 border-teal-200'
                          : 'bg-slate-50 text-slate-600 border-slate-200',
                      ].join(' ')}
                    >
                      {row.source}
                    </span>
                  </td>
                  <td className="py-1.5 px-1.5 text-[9px] font-medium text-slate-600">{row.tier}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-3 py-2 border-t border-black/[0.08] bg-white flex flex-wrap gap-1.5">
          {['SKU keresés', 'Excel feltöltés', 'Lista → kosár'].map(label => (
            <span
              key={label}
              className="inline-flex px-2 py-1 rounded text-[9px] font-semibold border border-teal-200 bg-teal-50/80 text-teal-800"
            >
              {label}
            </span>
          ))}
        </div>
      </Chrome>
      {!compact && (
      <FloatChip
        className="-bottom-1 -left-1 sm:left-0"
        title="10+ → −5% · 50+ → −8%"
        subtitle="mennyiségi sávok partnerenként"
        icon={
          <span className="w-full h-full rounded-lg bg-cyan-100 flex items-center justify-center text-[10px] font-bold text-cyan-800">
            %
          </span>
        }
      />
      )}
    </div>
  )
}

/* ── Webshop: rendelés puffer (Hero-stílus) ───────────────── */

const bufferRows = [
  { bolti: 'Shoprenter · Fő', customer: 'Kovács P.', amount: '14 900 Ft', wait: '8 perc', waitTier: 'fresh' as const, fulfill: 'all' as const, label: 'Raktáron' },
  { bolti: 'Shoprenter · Outlet', customer: 'Nagy E.', amount: '8 490 Ft', wait: '3 óra', waitTier: 'medium' as const, fulfill: 'partial' as const, label: 'Részben' },
  { bolti: 'Shoprenter · Fő', customer: 'Tóth G.', amount: '32 000 Ft', wait: '1 nap', waitTier: 'old' as const, fulfill: 'none' as const, label: 'Hiány' },
  { bolti: 'Shoprenter · B2B', customer: 'Szabó A.', amount: '5 990 Ft', wait: '25 perc', waitTier: 'fresh' as const, fulfill: 'unknown' as const, label: 'Ellenőrzés' },
]

function rowBg(f: (typeof bufferRows)[0]['fulfill']) {
  if (f === 'all') return 'bg-[rgba(232,245,233,0.45)]'
  if (f === 'partial') return 'bg-[rgba(255,243,224,0.55)]'
  if (f === 'none') return 'bg-[rgba(255,235,238,0.45)]'
  return 'bg-[rgba(250,250,250,0.9)]'
}

function waitChip(t: (typeof bufferRows)[0]['waitTier']) {
  if (t === 'fresh') return 'bg-[rgba(46,125,50,0.12)] text-[#2e7d32] border-[rgba(46,125,50,0.35)]'
  if (t === 'medium') return 'bg-[rgba(239,108,0,0.12)] text-[#e65100] border-[rgba(239,108,0,0.35)]'
  return 'bg-[rgba(198,40,40,0.12)] text-[#c62828] border-[rgba(198,40,40,0.35)]'
}

function fulfillPill(f: (typeof bufferRows)[0]['fulfill']) {
  if (f === 'all') return 'bg-[#e8f5e9] text-[#1b5e20] border-[#a5d6a7]'
  if (f === 'partial') return 'bg-[#fff8e1] text-[#e65100] border-[#ffcc80]'
  if (f === 'none') return 'bg-[#ffebee] text-[#b71c1c] border-[#ef9a9a]'
  return 'bg-[#fafafa] text-[#616161] border-[rgba(0,0,0,0.12)]'
}

function OrdersMock({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'relative w-full' : 'relative w-full pt-3 pr-2 pb-4 pl-1'}>
      {!compact && (
      <FloatChip
        className="-top-1 -right-1 sm:right-0"
        title="Raktáron?"
        subtitle="Feldolgozás egy kattintással"
        icon={
          <span className="w-full h-full rounded-lg bg-[#e8f5e9] flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-[#2e7d32]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
          </span>
        }
      />
      )}
      <Chrome url="mintawebshop.hu/orders/buffer" borderColor="rgba(251,146,60,0.35)">
        <div className="px-3 pt-2.5 pb-2 border-b border-black/[0.08] bg-white">
          <p className="text-[9px] text-slate-500 mb-0.5">
            Rendelések <span className="text-slate-300 mx-0.5">/</span>
            <span className="text-slate-700 font-medium">Rendelés puffer</span>
          </p>
                  <p className="text-[11px] font-semibold text-slate-800">Beérkező rendelések, készletellenőrzés</p>
        </div>
        <div className="px-3 py-1.5 border-b border-black/[0.08] bg-white flex flex-wrap items-center gap-1">
          <span className="text-[9px] text-slate-500">Teljesíthetőség:</span>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[#1976d2] text-white">Mind</span>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium text-slate-600 border border-black/[0.12]">Raktáron</span>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium text-slate-600 border border-black/[0.12]">Részben</span>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium text-slate-600 border border-black/[0.12]">Hiány</span>
        </div>
        <div className="bg-[#fafbfc] overflow-x-auto">
          <table className="w-full min-w-[400px] text-left border-collapse">
            <thead>
              <tr className="bg-black/[0.04] border-b border-black/[0.08]">
                {['Bolti', 'Vásárló', 'Összeg', 'Várakozás', 'Teljesíthetőség', ''].map((h, i) => (
                  <th key={`${h}-${i}`} className={`py-1.5 px-1.5 text-[9px] font-semibold text-slate-600 ${i === 5 ? 'text-right pr-2' : ''}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bufferRows.map((row, idx) => (
                <tr key={idx} className={`border-b border-black/[0.08] ${rowBg(row.fulfill)}`}>
                  <td className="py-1.5 px-1.5 text-[10px] font-medium text-slate-800 truncate max-w-[88px]">{row.bolti}</td>
                  <td className="py-1.5 px-1.5 text-[10px] font-medium text-[#1976d2] truncate">{row.customer}</td>
                  <td className="py-1.5 px-1.5 text-[10px] text-slate-800 whitespace-nowrap">{row.amount}</td>
                  <td className="py-1.5 px-1.5 whitespace-nowrap">
                    <span className={`inline-flex px-1 py-0.5 rounded text-[9px] font-medium border ${waitChip(row.waitTier)}`}>
                      {row.wait}
                    </span>
                  </td>
                  <td className="py-1.5 px-1.5 whitespace-nowrap">
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-semibold border ${fulfillPill(row.fulfill)}`}>
                      {row.label}
                    </span>
                  </td>
                  <td className="py-1.5 px-1.5 text-right">
                    <span className="inline-block px-1.5 py-0.5 text-[9px] font-semibold text-[#1976d2] border border-[rgba(25,118,210,0.45)] rounded bg-white">
                      Feldolgozás
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-1.5 bg-[#fafbfc] border-t border-black/[0.08]">
          <p className="text-[9px] text-slate-500">Készlet szerint színezve · multi-webshop</p>
        </div>
      </Chrome>
      {!compact && (
      <FloatChip
        className="-bottom-1 -left-1 sm:left-0"
        title="Várakozás látható"
        subtitle="Perc, óra vagy nap, soronként"
        icon={
          <span className="w-full h-full rounded-lg bg-[#fff8e1] flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-[#e65100]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </span>
        }
      />
      )}
    </div>
  )
}

/* ── Asztalos: lapszabászat optimalizáló (/opti) ──────────── */

/** Placements on a 2800×2070 board — percentages match OptiClient blueprint layout */
const OPTI_PARTS = [
  { id: 'A1', label: 'Ajtó', w: 600, h: 720, left: 1.8, top: 1.9, width: 21.4, height: 34.8, bg: '#e8f0fe' },
  { id: 'A2', label: 'Ajtó', w: 600, h: 720, left: 24.0, top: 1.9, width: 21.4, height: 34.8, bg: '#e8f0fe' },
  { id: 'O1', label: 'Oldal', w: 560, h: 720, left: 46.2, top: 1.9, width: 20.0, height: 34.8, bg: '#e6f4ea' },
  { id: 'O2', label: 'Oldal', w: 560, h: 720, left: 67.0, top: 1.9, width: 20.0, height: 34.8, bg: '#e6f4ea' },
  { id: 'F1', label: 'Fenék', w: 1120, h: 560, left: 1.8, top: 38.0, width: 40.0, height: 27.0, bg: '#fef7e0' },
  { id: 'F2', label: 'Polc', w: 1120, h: 560, left: 42.6, top: 38.0, width: 40.0, height: 27.0, bg: '#fef7e0' },
  { id: 'H1', label: 'Hátlap', w: 560, h: 400, left: 1.8, top: 66.5, width: 20.0, height: 19.3, bg: '#fce7f3' },
  { id: 'H2', label: 'Hátlap', w: 560, h: 400, left: 22.6, top: 66.5, width: 20.0, height: 19.3, bg: '#fce7f3' },
  { id: 'K1', label: 'Keret', w: 400, h: 400, left: 43.4, top: 66.5, width: 14.3, height: 19.3, bg: '#f1f3f4' },
]

function CutlistMock({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'relative w-full' : 'relative w-full pt-2 pb-3'}>
      {!compact && (
      <FloatChip
        className="-top-0.5 right-0 z-20"
        title="92% kihasználás"
        subtitle="Guillotine optimalizálás"
        icon={
          <span className="w-full h-full rounded-lg bg-indigo-100 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-indigo-700" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </span>
        }
      />
      )}
      <Chrome url="portal.turinova.hu/opti" borderColor="rgba(99,102,241,0.4)">
        {/* Accordion-style material header — mirrors OptiClient */}
        <div className="px-3 py-2.5 border-b border-black/[0.08] bg-[#f5f5f5] flex flex-wrap items-center gap-1.5">
          <p className="text-[12px] font-bold text-slate-900 mr-1">Bútorlap 18 mm · Fehér</p>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium border border-[#0288d1] text-[#0277bd]">
            2800×2070mm
          </span>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium border border-amber-400 text-amber-800 bg-amber-50">
            Szálirányos
          </span>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium border border-indigo-400 text-indigo-800">
            2 tábla
          </span>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-800">
            Vágás: 48.2 m
          </span>
        </div>

        <div className="p-3 bg-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold text-slate-700">Tábla 1 / 2 · szabásterv</p>
            <div className="flex gap-1">
              <span className="px-2 py-0.5 rounded text-[9px] font-semibold bg-indigo-600 text-white">← Előző</span>
              <span className="px-2 py-0.5 rounded text-[9px] font-medium border border-slate-200 text-slate-600">Következő →</span>
            </div>
          </div>

          {/* Blueprint board — OptiClient style */}
          <div
            className="relative w-full border border-black overflow-hidden mx-auto"
            style={{
              aspectRatio: '2800 / 2070',
              backgroundColor: '#f0f8ff',
              maxWidth: 520,
            }}
          >
            {/* Trim margins (hatched) */}
            <div
              className="absolute inset-x-0 top-0 border-b border-dashed border-slate-400/40 z-[2]"
              style={{
                height: '1.9%',
                background:
                  'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(158,158,158,0.2) 2px, rgba(158,158,158,0.2) 4px)',
              }}
            />
            <div
              className="absolute inset-y-0 left-0 border-r border-dashed border-slate-400/40 z-[2]"
              style={{
                width: '1.8%',
                background:
                  'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(158,158,158,0.2) 2px, rgba(158,158,158,0.2) 4px)',
              }}
            />

            {OPTI_PARTS.map(p => (
              <div
                key={p.id}
                className="absolute border border-black flex items-center justify-center"
                style={{
                  left: `${p.left}%`,
                  top: `${p.top}%`,
                  width: `${p.width}%`,
                  height: `${p.height}%`,
                  backgroundColor: p.bg,
                }}
              >
                {/* Grain lines */}
                <div className="absolute inset-x-[6%] top-[20%] h-px bg-slate-400/50" />
                <div className="absolute inset-x-[6%] top-[40%] h-px bg-slate-400/50" />
                <div className="absolute inset-x-[6%] top-[60%] h-px bg-slate-400/50" />
                <div className="absolute inset-x-[6%] top-[80%] h-px bg-slate-400/50" />
                <span className="absolute top-0.5 left-1/2 -translate-x-1/2 text-[8px] text-black font-normal leading-none">
                  {p.w}
                </span>
                <span className="relative z-[1] text-[9px] font-bold text-slate-800">{p.id}</span>
                <span className="absolute left-0.5 top-1/2 -translate-y-1/2 text-[7px] text-black [writing-mode:vertical-rl] rotate-180 leading-none">
                  {p.h}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-2.5 grid grid-cols-4 gap-1.5">
            {[
              { k: 'Darab', v: '18' },
              { k: 'Kihasználás', v: '92%' },
              { k: 'Hulladék', v: '8%' },
              { k: 'Idő', v: '~3 mp' },
            ].map(s => (
              <div key={s.k} className="rounded border border-indigo-100 bg-indigo-50/50 px-1.5 py-1.5 text-center">
                <p className="text-[8px] text-slate-500">{s.k}</p>
                <p className="text-[12px] font-bold text-indigo-900">{s.v}</p>
              </div>
            ))}
          </div>
        </div>
      </Chrome>
      {!compact && (
      <FloatChip
        className="-bottom-1 -left-1 sm:left-0 z-20"
        title="Méret + szálirány"
        subtitle="Minden darabon látszik"
        icon={
          <span className="w-full h-full rounded-lg bg-[#e8f0fe] flex items-center justify-center text-[9px] font-bold text-indigo-700">
            mm
          </span>
        }
      />
      )}
    </div>
  )
}

/* ── Vásárlószámláló: heatmap ────────────────────────────── */

const HOURLY = [0, 3, 7, 12, 18, 22, 19, 14, 16, 24, 28, 17]
const HOURS = ['7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18']
const WEEK = [
  { d: 'H', v: 134 },
  { d: 'K', v: 147 },
  { d: 'Sze', v: 142 },
  { d: 'Cs', v: 138 },
  { d: 'P', v: 156 },
  { d: 'Szo', v: 189 },
  { d: 'V', v: 42 },
]

function heatBg(v: number, max: number) {
  if (v <= 0) return 'rgba(16,185,129,0.06)'
  const t = Math.min(1, v / max)
  return `rgba(5,150,105,${(0.12 + t * 0.72).toFixed(2)})`
}

function FootfallMock() {
  const maxH = Math.max(...HOURLY)
  const weekMax = Math.max(...WEEK.map(w => w.v))
  return (
    <div className="relative w-full pt-2 pb-3">
      <FloatChip
        className="-top-0.5 right-0"
        title="+18% ma"
        subtitle="ugyanahhoz a hétnaphoz képest"
        icon={
          <span className="w-full h-full rounded-lg bg-emerald-100 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-emerald-700" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5 12 12l4.5 4.5L19.5 9" />
            </svg>
          </span>
        }
      />
      <Chrome url="portal.turinova.hu/bolti-analitika" borderColor="rgba(16,185,129,0.35)">
        <div className="px-3 pt-2.5 pb-2 border-b border-black/[0.08] flex items-center justify-between">
          <div>
            <p className="text-[9px] text-slate-500">Főbejárat · élő</p>
            <p className="text-[11px] font-semibold text-slate-800">Mai forgalom</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-extrabold text-emerald-700 leading-none">147</p>
            <p className="text-[9px] text-slate-500">belépő · 134 kilépő</p>
          </div>
        </div>
        <div className="p-3 bg-[#fafbfc] space-y-3">
          <div>
            <p className="text-[9px] font-semibold text-slate-600 mb-1.5">Óránkénti hőtérkép (7-18)</p>
            <div className="grid grid-cols-12 gap-0.5">
              {HOURLY.map((v, i) => (
                <div key={i} className="flex flex-col items-center gap-0.5">
                  <div
                    className="w-full aspect-square rounded-sm border border-emerald-900/5"
                    style={{ background: heatBg(v, maxH) }}
                    title={`${HOURS[i]}:00: ${v}`}
                  />
                  <span className="text-[7px] text-slate-400">{HOURS[i]}</span>
                </div>
              ))}
            </div>
            <p className="mt-1 text-[9px] text-emerald-700 font-medium">Csúcs: 16:00 · 28 belépő</p>
          </div>
          <div className="rounded-lg border border-emerald-100 bg-white p-2">
            <p className="text-[9px] font-semibold text-slate-600 mb-1.5">Heti áttekintés</p>
            <div className="flex items-end gap-1 h-12">
              {WEEK.map((w, i) => (
                <div key={w.d} className="flex-1 flex flex-col items-center gap-0.5 h-full justify-end">
                  <div
                    className={`w-full rounded-t ${i === 1 ? 'bg-emerald-500' : 'bg-emerald-300/70'}`}
                    style={{ height: `${Math.max(8, (w.v / weekMax) * 100)}%` }}
                  />
                  <span className="text-[7px] text-slate-500">{w.d}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Chrome>
    </div>
  )
}

/* ── Munkaidő: jelenléti tábla ───────────────────────────── */

const staff = [
  { name: 'Kiss Anna', role: 'Pult', in: '07:58', out: '16:02', status: 'ok' as const, hrs: '8:04' },
  { name: 'Nagy Béla', role: 'Raktár', in: '08:02', out: '-', status: 'active' as const, hrs: 'folyamatban' },
  { name: 'Szabó Csilla', role: 'Pult', in: '-', out: '-', status: 'missing' as const, hrs: '-' },
  { name: 'Tóth Dénes', role: 'Vezető', in: '07:45', out: '16:10', status: 'ok' as const, hrs: '8:25' },
  { name: 'Varga Emese', role: 'Pult', in: '12:00', out: '-', status: 'active' as const, hrs: 'délutáni' },
]

function statusPill(s: (typeof staff)[0]['status']) {
  if (s === 'ok') return 'bg-sky-50 text-sky-800 border-sky-200'
  if (s === 'active') return 'bg-emerald-50 text-emerald-800 border-emerald-200'
  return 'bg-amber-50 text-amber-800 border-amber-200'
}

function statusLabel(s: (typeof staff)[0]['status']) {
  if (s === 'ok') return 'Lezárt'
  if (s === 'active') return 'Bent'
  return 'Hiányzik'
}

function AttendanceMock() {
  return (
    <div className="relative w-full pt-2 pb-3">
      <FloatChip
        className="-top-0.5 right-0"
        title="4 / 5 jelen"
        subtitle="1 hiányzó riasztás"
        icon={
          <span className="w-full h-full rounded-lg bg-sky-100 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-sky-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.25.3 8.25 8.25 0 0 0 7.5-4.5M9 19.128A9.38 9.38 0 0 1 6.75 19.5a8.25 8.25 0 0 1-7.5-4.5m15.75 0v-.375A2.625 2.625 0 0 0 12.75 12h-1.5A2.625 2.625 0 0 0 8.625 14.625v.375" />
            </svg>
          </span>
        }
      />
      <Chrome url="portal.turinova.hu/jelenlet" borderColor="rgba(14,165,233,0.35)">
        <div className="px-3 pt-2.5 pb-2 border-b border-black/[0.08] flex items-center justify-between">
          <div>
            <p className="text-[9px] text-slate-500">Mai nap · Főbolt</p>
            <p className="text-[11px] font-semibold text-slate-800">Jelenléti ív</p>
          </div>
          <div className="flex gap-1">
            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-sky-600 text-white">Ma</span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-medium border border-slate-200 text-slate-600">Hét</span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-medium border border-slate-200 text-slate-600">Export</span>
          </div>
        </div>
        <div className="bg-[#fafbfc] overflow-x-auto">
          <table className="w-full min-w-[360px] text-left">
            <thead>
              <tr className="bg-black/[0.04] border-b border-black/[0.08]">
                {['Név', 'Szerep', 'Be', 'Ki', 'Óra', 'Állapot'].map(h => (
                  <th key={h} className="py-1.5 px-2 text-[9px] font-semibold text-slate-600">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map(r => (
                <tr key={r.name} className="border-b border-black/[0.06] bg-white">
                  <td className="py-1.5 px-2 text-[10px] font-semibold text-slate-800 whitespace-nowrap">{r.name}</td>
                  <td className="py-1.5 px-2 text-[10px] text-slate-500">{r.role}</td>
                  <td className="py-1.5 px-2 text-[10px] font-medium text-sky-800">{r.in}</td>
                  <td className="py-1.5 px-2 text-[10px] text-slate-600">{r.out}</td>
                  <td className="py-1.5 px-2 text-[10px] text-slate-700">{r.hrs}</td>
                  <td className="py-1.5 px-2">
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-semibold border ${statusPill(r.status)}`}>
                      {statusLabel(r.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-1.5 border-t border-black/[0.08] bg-white flex gap-3 text-[9px] text-slate-500">
          <span>Műszak A: 07:00-16:00</span>
          <span>Műszak B: 12:00-20:00</span>
        </div>
      </Chrome>
    </div>
  )
}

/* ── Egyedi: integrációs pipeline ────────────────────────── */

const nodes = [
  { id: 'ws', label: 'Webshop', sub: 'Shoprenter', ok: true },
  { id: 'erp', label: 'Turinova', sub: 'Központ', ok: true, hub: true },
  { id: 'inv', label: 'Számlázó', sub: 'Számlázz.hu', ok: true },
  { id: 'ship', label: 'Futár', sub: 'GLS / Foxpost', ok: true },
  { id: 'wms', label: 'WMS', sub: 'Egyedi API', ok: false },
]

function CustomMock() {
  return (
    <div className="relative w-full pt-2 pb-3">
      <FloatChip
        className="-top-0.5 right-0"
        title="Webhook élő"
        subtitle="sync 2 percenként"
        icon={
          <span className="w-full h-full rounded-lg bg-violet-100 flex items-center justify-center">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-600" />
            </span>
          </span>
        }
      />
      <Chrome url="portal.turinova.hu/integraciok" borderColor="rgba(139,92,246,0.35)">
        <div className="px-3 pt-2.5 pb-2 border-b border-black/[0.08]">
          <p className="text-[9px] text-slate-500">Egyedi fejlesztés / Integrációk</p>
          <p className="text-[11px] font-semibold text-slate-800">Kapcsolódó rendszerek</p>
        </div>
        <div className="p-3 bg-[#fafbfc] space-y-3">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {nodes.map((n, i) => (
              <div key={n.id} className="flex items-center gap-2">
                <div
                  className={[
                    'rounded-xl border px-2.5 py-2 min-w-[78px] text-center shadow-sm',
                    n.hub
                      ? 'bg-violet-600 border-violet-700 text-white'
                      : n.ok
                        ? 'bg-white border-violet-200'
                        : 'bg-amber-50 border-amber-200 border-dashed',
                  ].join(' ')}
                >
                  <p className={`text-[10px] font-bold ${n.hub ? 'text-white' : 'text-slate-800'}`}>{n.label}</p>
                  <p className={`text-[8px] ${n.hub ? 'text-violet-100' : 'text-slate-500'}`}>{n.sub}</p>
                </div>
                {i < nodes.length - 1 && (
                  <svg className="w-3.5 h-3.5 text-violet-300 shrink-0 hidden sm:block" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                )}
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-violet-100 bg-white p-2.5 space-y-1.5">
            {[
              { ev: 'order.created', t: '12 mp', ok: true },
              { ev: 'stock.sync', t: '1 perc', ok: true },
              { ev: 'wms.pull', t: 'várakozik', ok: false },
            ].map(e => (
              <div key={e.ev} className="flex items-center justify-between text-[10px]">
                <code className="font-mono text-violet-800 bg-violet-50 px-1.5 py-0.5 rounded">{e.ev}</code>
                <span className={e.ok ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'}>{e.t}</span>
              </div>
            ))}
          </div>
          <p className="text-[9px] text-slate-500 text-center">API, webhook, ütemezett sync</p>
        </div>
      </Chrome>
    </div>
  )
}

export default function SolutionMock({
  kind,
  compact = false,
}: {
  kind: SolutionMockKind
  /** Hero stack: no floating chips, tighter padding */
  compact?: boolean
}) {
  switch (kind) {
    case 'b2b-pricing':
      return <B2bPricingMock compact={compact} />
    case 'orders':
      return <OrdersMock compact={compact} />
    case 'cutlist':
      return <CutlistMock compact={compact} />
    case 'footfall':
      return <FootfallMock />
    case 'attendance':
      return <AttendanceMock />
    case 'custom':
      return <CustomMock />
    default:
      return null
  }
}
