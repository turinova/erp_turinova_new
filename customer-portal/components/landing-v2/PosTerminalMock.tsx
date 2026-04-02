/** Fictív URL — nem valós domain (landing mock). */
const MOCK_BROWSER_URL = 'mintawebshop.hu/pos'

const searchRows = [
  {
    imageSrc: '/banner/teddy.jpg',
    name: 'Játékmackó · plüss',
    sku: 'JTK-MACKO-01',
    stock: '12 db',
    price: '12 990 Ft',
    selected: true,
  },
  {
    imageSrc: '/banner/puzlle.jpeg',
    name: 'Puzzle 1000 db',
    sku: 'PZ-1000-GR',
    stock: '8 db',
    price: '8 490 Ft',
    selected: false,
  },
  {
    imageSrc: '/banner/lego.jpg',
    name: 'LEGO Creator 3in1',
    sku: 'LG-31145',
    stock: '4 db',
    price: '24 990 Ft',
    selected: false,
  },
] as const

const cartRows = [
  {
    name: 'Játékmackó · plüss',
    sku: 'JTK-MACKO-01',
    qty: '1',
    unit: 'db',
    lineTotal: '12 990 Ft',
  },
  {
    name: 'Puzzle 1000 db',
    sku: 'PZ-1000-GR',
    qty: '2',
    unit: 'db',
    lineTotal: '16 980 Ft',
  },
] as const

const CART_TOTAL_HUF = '29 970'

function QtyControlMock({ qty }: { qty: string }) {
  return (
    <div className="flex items-center justify-center gap-0.5">
      <span
        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#1976d2] border border-black/[0.12] bg-white"
        aria-hidden
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M19 13H5v-2h14v2z" />
        </svg>
      </span>
      <span className="inline-flex h-7 min-w-[2.5rem] items-center justify-center rounded border border-black/[0.23] bg-white text-[11px] font-semibold text-slate-900 px-1">
        {qty}
      </span>
      <span
        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#1976d2] border border-black/[0.12] bg-white"
        aria-hidden
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
        </svg>
      </span>
    </div>
  )
}

export default function PosTerminalMock() {
  return (
    <div className="rounded-2xl border border-orange-200/70 bg-white overflow-hidden shadow-md text-left">
      <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border-b border-slate-200">
        <span className="w-2.5 h-2.5 rounded-full bg-red-300 shrink-0" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-300 shrink-0" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-300 shrink-0" />
        <div className="ml-2 min-w-0 flex-1 h-6 rounded-md bg-white border border-slate-200 px-2 flex items-center">
          <span className="truncate text-[10px] text-slate-500 font-mono">{MOCK_BROWSER_URL}</span>
        </div>
      </div>

      <div className="p-3 sm:p-4 flex flex-col lg:flex-row gap-4 lg:gap-3 lg:items-stretch min-h-[min(420px,70vh)] sm:min-h-[440px]">
        <div className="flex-1 min-w-0 lg:flex-[5] lg:basis-0 flex flex-col min-h-0">
          <p className="text-xs sm:text-sm font-semibold text-slate-800 mb-1.5 shrink-0">Termék keresés</p>
          <div className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-2 py-1.5 mb-2 shrink-0 shadow-sm">
            <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <span className="text-[11px] text-slate-400 truncate">Vonalkód / SKU / Név</span>
          </div>

          <div className="flex-1 min-h-[200px] sm:min-h-[240px] rounded-md border border-slate-200 overflow-hidden flex flex-col bg-[#fafbfc]">
            <div className="overflow-x-auto flex-1">
              <table className="w-full min-w-[300px] text-left border-collapse text-[10px] sm:text-[11px]">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200">
                    <th className="py-2 pl-2 pr-1 font-bold text-slate-700 w-12">Kép</th>
                    <th className="py-2 px-1 font-bold text-slate-700">Termék neve</th>
                    <th className="py-2 px-1 font-bold text-slate-700 whitespace-nowrap">Típus</th>
                    <th className="py-2 px-1 font-bold text-slate-700 text-right whitespace-nowrap">Készlet</th>
                    <th className="py-2 pr-2 pl-1 font-bold text-slate-700 text-right whitespace-nowrap">Ár</th>
                  </tr>
                </thead>
                <tbody>
                  {searchRows.map(row => (
                    <tr
                      key={row.sku}
                      className={`border-b border-slate-200/90 ${row.selected ? 'bg-[rgba(25,118,210,0.08)]' : 'hover:bg-slate-50/80'}`}
                    >
                      <td className="py-2 pl-2 pr-1 align-middle">
                        <img
                          src={row.imageSrc}
                          alt=""
                          className="h-9 w-9 sm:h-10 sm:w-10 rounded object-cover border border-slate-200 bg-white"
                          loading="lazy"
                          decoding="async"
                        />
                      </td>
                      <td className="py-2 px-1 align-middle min-w-0">
                        <p className="font-bold text-slate-900 truncate">{row.name}</p>
                        <p className="text-[9px] text-slate-500 truncate">SKU: {row.sku}</p>
                      </td>
                      <td className="py-2 px-1 align-middle whitespace-nowrap">
                        <span className="inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                          Kellék
                        </span>
                      </td>
                      <td className="py-2 px-1 align-middle text-right text-slate-700 whitespace-nowrap">{row.stock}</td>
                      <td className="py-2 pr-2 pl-1 align-middle text-right font-bold text-[#1976d2] whitespace-nowrap">{row.price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[9px] text-slate-400 px-2 py-1.5 border-t border-slate-200 bg-white shrink-0">
              Enter: kosárba · ↑↓ lista · Kép: illusztráció.
            </p>
          </div>
        </div>

        <div className="flex-1 min-w-0 lg:flex-[7] lg:basis-0 flex flex-col min-h-0 border-t lg:border-t-0 lg:border-l border-orange-100/80 lg:pl-3 pt-3 lg:pt-0">
          <p className="text-xs sm:text-sm font-semibold text-slate-800 mb-1.5 shrink-0">Vásárlás</p>
          <div className="rounded-md border border-slate-300 bg-white px-2 py-1.5 mb-2 shrink-0 text-[11px] shadow-sm">
            <span className="text-slate-400 block text-[9px] mb-0.5">Ügyfél neve</span>
            <span className="font-medium text-slate-800">Nagy Eszter</span>
          </div>

          <div className="flex-1 min-h-[180px] sm:min-h-[220px] rounded-md border border-slate-200 overflow-hidden flex flex-col bg-[#fafbfc]">
            <div className="overflow-x-auto flex-1 min-h-[120px]">
              <table className="w-full table-fixed text-left border-collapse text-[10px] sm:text-[11px]">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200">
                    <th className="py-2 pl-2 pr-1 font-bold text-slate-700 w-[40%]">Termék</th>
                    <th className="py-2 px-0.5 font-bold text-slate-700 text-center w-[32%]">Mennyiség</th>
                    <th className="py-2 px-0.5 font-bold text-slate-700 text-center w-[12%]">Egység</th>
                    <th className="py-2 pr-2 pl-0.5 font-bold text-slate-700 text-right w-[16%]">Összeg</th>
                  </tr>
                </thead>
                <tbody>
                  {cartRows.map(row => (
                    <tr key={row.sku} className="border-b border-slate-200 bg-white align-top">
                      <td className="py-2 pl-2 pr-1 align-top">
                        <p className="font-bold text-slate-900 leading-snug break-words">{row.name}</p>
                        <p className="text-[9px] text-slate-500 truncate">SKU: {row.sku}</p>
                      </td>
                      <td className="py-2 px-0.5 align-middle">
                        <QtyControlMock qty={row.qty} />
                      </td>
                      <td className="py-2 px-0.5 align-middle text-center text-slate-800 whitespace-nowrap">{row.unit}</td>
                      <td className="py-2 pr-2 pl-0.5 align-middle text-right font-bold text-[#1976d2] whitespace-nowrap leading-tight">
                        {row.lineTotal}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-2 flex justify-center gap-2 shrink-0" aria-hidden>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#1976d2] text-[#1976d2] bg-white">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
              </svg>
            </span>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-purple-600 text-purple-600 bg-white">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z" />
              </svg>
            </span>
          </div>

          <div className="mt-3 shrink-0 space-y-2">
            <div className="h-px bg-slate-200" aria-hidden />
            <div className="flex justify-between items-baseline gap-2">
              <span className="text-sm font-semibold text-slate-800">Összesen:</span>
              <span className="text-base sm:text-lg font-bold text-[#1976d2]">{CART_TOTAL_HUF} HUF</span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                tabIndex={-1}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] sm:text-xs font-bold py-2.5 sm:py-3 px-2 shadow-sm border border-emerald-700/30"
              >
                <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z" />
                </svg>
                Készpénz
              </button>
              <button
                type="button"
                tabIndex={-1}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-[#1976d2] hover:bg-[#1565c0] text-white text-[11px] sm:text-xs font-bold py-2.5 sm:py-3 px-2 shadow-sm border border-[#1565c0]/40"
              >
                <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z" />
                </svg>
                Bankkártya
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
