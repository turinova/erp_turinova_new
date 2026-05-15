/**
 * Static recreation of the customer-portal /saved page.
 * Mock list of saved projects an asztalos would build over time.
 */

const ROWS = [
  {
    num: "POR-2026/047",
    note: "Konyha • Kovács Gábor • 6 ajtó + fiókhomlokok",
    total: "65 862 Ft",
    when: "2026.05.07. 14:22",
  },
  {
    num: "POR-2026/045",
    note: "Iroda • Tüske ügyvédi • polcok + asztallap",
    total: "112 480 Ft",
    when: "2026.05.05. 09:18",
  },
  {
    num: "POR-2026/041",
    note: "Gardrób • Nagy Eszter • MDF frontok",
    total: "84 920 Ft",
    when: "2026.05.02. 16:40",
  },
  {
    num: "POR-2026/038",
    note: "Konyha • Pintér család • sziget munkalap",
    total: "48 270 Ft",
    when: "2026.04.28. 11:05",
  },
] as const

export default function SavedQuotesMockup() {
  return (
    <div
      className="w-full rounded-2xl bg-white overflow-hidden"
      style={{
        border: "1px solid rgba(0,0,0,0.08)",
        boxShadow: "0 12px 32px rgba(0,0,0,0.10)",
      }}
    >
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border-b border-slate-200">
        <span className="w-2 h-2 rounded-full bg-red-300 shrink-0" />
        <span className="w-2 h-2 rounded-full bg-amber-300 shrink-0" />
        <span className="w-2 h-2 rounded-full bg-emerald-300 shrink-0" />
        <div className="ml-2 min-w-0 flex-1 h-5 rounded-md bg-white border border-slate-200 px-2 flex items-center">
          <span className="truncate text-[9px] text-slate-500 font-mono">
            www.turinova.hu/saved
          </span>
        </div>
      </div>

      {/* Page header */}
      <div className="px-3 pt-2.5 pb-2 border-b border-black/[0.08]">
        <p className="text-[9px] text-slate-500 mb-0.5">
          <span className="text-slate-400">Kezdőlap</span>
          <span className="mx-1 text-slate-300">/</span>
          <span className="text-slate-700 font-medium">Mentések</span>
        </p>
        <p className="text-[12px] font-semibold text-slate-800">
          Mentett árajánlataim
        </p>
      </div>

      {/* Search bar */}
      <div className="px-3 py-2 bg-white border-b border-slate-200">
        <div className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-2 py-1.5">
          <svg
            className="w-3 h-3 text-slate-400 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
            />
          </svg>
          <span className="text-[10px] text-slate-400 truncate">
            Keresés árajánlat szám alapján…
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[10px] border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="py-1.5 pl-2 pr-1 font-bold text-slate-700 w-6" />
              <th className="py-1.5 px-1 font-bold text-slate-700">
                Árajánlat
              </th>
              <th className="py-1.5 px-1 font-bold text-slate-700">
                Megjegyzés
              </th>
              <th className="py-1.5 px-1 font-bold text-slate-700 text-right">
                Végösszeg
              </th>
              <th className="py-1.5 pr-2 pl-1 font-bold text-slate-700">
                Módosítva
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr
                key={r.num}
                className="border-b border-slate-200/90 hover:bg-slate-50/80"
              >
                <td className="py-1.5 pl-2 pr-1 align-middle">
                  <span className="inline-block w-3 h-3 border border-slate-300 rounded-sm bg-white" />
                </td>
                <td className="py-1.5 px-1 align-middle">
                  <span className="font-bold text-[#1976d2] font-mono">
                    {r.num}
                  </span>
                </td>
                <td className="py-1.5 px-1 align-middle text-slate-700 truncate max-w-[180px]">
                  {r.note}
                </td>
                <td className="py-1.5 px-1 align-middle text-right font-bold text-slate-800 whitespace-nowrap">
                  {r.total}
                </td>
                <td className="py-1.5 pr-2 pl-1 align-middle text-slate-500 whitespace-nowrap text-[9px]">
                  {r.when}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[9px] text-slate-500">
        <span>Összesen 4 árajánlat</span>
        <span className="text-slate-400">‹ 1 ›</span>
      </div>
    </div>
  )
}
