"use client"

import type { SubcontractorActivityItem } from "@/lib/subcontractor-queries"
import { cn } from "@/lib/utils"

type SubcontractorActivityFeedProps = {
  items: SubcontractorActivityItem[]
}

function activityKind(label: string): { kind: string; badge: string } {
  if (label.includes("elfogadva")) {
    return { kind: "Elfogadás", badge: "bg-emerald-100 text-emerald-900" }
  }
  if (label.includes("beküldve")) {
    return { kind: "Ajánlat", badge: "bg-blue-100 text-blue-900" }
  }
  if (label.includes("meghívás")) {
    return { kind: "RFQ", badge: "bg-amber-100 text-amber-900" }
  }
  return { kind: "Esemény", badge: "bg-slate-100 text-slate-800" }
}

function formatWhen(at: string): string {
  const d = new Date(at)
  const now = new Date()
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()

  if (sameDay) {
    return `Ma ${d.toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit" })}`
  }
  return d.toLocaleDateString("hu-HU", {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  })
}

export function SubcontractorActivityFeed({ items }: SubcontractorActivityFeedProps) {
  return (
    <section className="border-t border-slate-100 px-5 py-3.5">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Tevékenység
      </p>

      {items.length === 0 ? (
        <p className="text-sm text-slate-600">Még nincs RFQ esemény.</p>
      ) : (
        <div className="max-h-64 overflow-auto">
          <table className="w-full text-sm">
            <tbody>
              {items.map((ev) => {
                const { kind, badge } = activityKind(ev.label)
                return (
                  <tr key={ev.id} className="border-b border-slate-50 last:border-0">
                    <td className="whitespace-nowrap py-2 pr-3 tabular-nums text-slate-500">
                      {formatWhen(ev.at)}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3">
                      <span className={cn("rounded px-1.5 py-0.5 text-xs font-semibold", badge)}>
                        {kind}
                      </span>
                    </td>
                    <td className="py-2 pr-3 font-medium text-slate-900">{ev.label}</td>
                    <td className="py-2 text-slate-600">{ev.detail ?? "—"}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
