/**
 * Static recreation of the customer-portal /orders page.
 * Status chips match OrdersClient.tsx semantics:
 *   draft       → "Beküldve" (warning)
 *   ordered     → "Megrendelve" (success)
 *   in_production → "Gyártásban" (info)
 *   ready       → "Gyártás kész" (primary)
 *   finished    → "Átadva" (success)
 */

type Status = "Beküldve" | "Gyártásban" | "Gyártás kész" | "Átadva"

const STATUS_STYLE: Record<
  Status,
  { bg: string; text: string; border: string }
> = {
  "Beküldve": {
    bg: "bg-[#fff8e1]",
    text: "text-[#e65100]",
    border: "border-[#ffcc80]",
  },
  "Gyártásban": {
    bg: "bg-[#e3f2fd]",
    text: "text-[#0d47a1]",
    border: "border-[#90caf9]",
  },
  "Gyártás kész": {
    bg: "bg-[#ede7f6]",
    text: "text-[#311b92]",
    border: "border-[#b39ddb]",
  },
  "Átadva": {
    bg: "bg-[#e8f5e9]",
    text: "text-[#1b5e20]",
    border: "border-[#a5d6a7]",
  },
}

const ROWS: Array<{
  num: string
  status: Status
  total: string
  when: string
}> = [
  {
    num: "AJ-2026/00214",
    status: "Gyártásban",
    total: "65 862 Ft",
    when: "2026.05.07.",
  },
  {
    num: "AJ-2026/00210",
    status: "Gyártás kész",
    total: "112 480 Ft",
    when: "2026.05.05.",
  },
  {
    num: "AJ-2026/00204",
    status: "Átadva",
    total: "48 270 Ft",
    when: "2026.05.02.",
  },
  {
    num: "AJ-2026/00197",
    status: "Beküldve",
    total: "21 350 Ft",
    when: "2026.04.30.",
  },
]

function StatusChip({ status }: { status: Status }) {
  const s = STATUS_STYLE[status]
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold border ${s.bg} ${s.text} ${s.border}`}
    >
      {status}
    </span>
  )
}

export default function OrdersMockup() {
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
            www.turinova.hu/orders
          </span>
        </div>
      </div>

      {/* Page header */}
      <div className="px-3 pt-2.5 pb-2 border-b border-black/[0.08]">
        <p className="text-[9px] text-slate-500 mb-0.5">
          <span className="text-slate-400">Kezdőlap</span>
          <span className="mx-1 text-slate-300">/</span>
          <span className="text-slate-700 font-medium">Megrendelések</span>
        </p>
        <p className="text-[12px] font-semibold text-slate-800">
          Elküldött árajánlataim
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[10px] border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="py-1.5 pl-3 pr-1 font-bold text-slate-700">
                Rendelés
              </th>
              <th className="py-1.5 px-1 font-bold text-slate-700 text-right">
                Végösszeg
              </th>
              <th className="py-1.5 px-1 font-bold text-slate-700">Státusz</th>
              <th className="py-1.5 pr-3 pl-1 font-bold text-slate-700">
                Beküldve
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr
                key={r.num}
                className="border-b border-slate-200/90 hover:bg-slate-50/80"
              >
                <td className="py-1.5 pl-3 pr-1 align-middle">
                  <span className="font-bold text-[#1976d2] font-mono">
                    {r.num}
                  </span>
                </td>
                <td className="py-1.5 px-1 align-middle text-right font-bold text-slate-800 whitespace-nowrap">
                  {r.total}
                </td>
                <td className="py-1.5 px-1 align-middle">
                  <StatusChip status={r.status} />
                </td>
                <td className="py-1.5 pr-3 pl-1 align-middle text-slate-500 whitespace-nowrap text-[9px]">
                  {r.when}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer with progress bar visualizing the highlighted row */}
      <div className="px-3 py-2 bg-slate-50 border-t border-slate-200">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[9px] text-slate-600 font-medium">
            AJ-2026/00214 • Gyártás állapota
          </p>
          <span className="text-[9px] text-slate-500">3 / 4</span>
        </div>
        <div className="grid grid-cols-4 gap-1">
          <div className="h-1.5 rounded-sm bg-emerald-500" />
          <div className="h-1.5 rounded-sm bg-emerald-500" />
          <div className="h-1.5 rounded-sm bg-emerald-500" />
          <div className="h-1.5 rounded-sm bg-slate-200" />
        </div>
        <div className="mt-1 grid grid-cols-4 gap-1 text-[8px] text-slate-500 text-center">
          <span>Beküldve</span>
          <span>Megrendelve</span>
          <span>Gyártásban</span>
          <span className="text-slate-400">Átadva</span>
        </div>
      </div>
    </div>
  )
}
