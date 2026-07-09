"use client"

import type { OverviewActivityItem } from "@/lib/project-overview-activity"
import { cn } from "@/lib/utils"

type ProjectOverviewActivityFeedProps = {
  items: OverviewActivityItem[]
}

const KIND_BADGE: Record<OverviewActivityItem["kind"], string> = {
  quote: "bg-blue-200 text-blue-950",
  rfq: "bg-amber-200 text-amber-950",
  decision: "bg-emerald-200 text-emerald-950",
  file: "bg-slate-200 text-slate-800",
  project: "bg-violet-200 text-violet-950",
}

function formatWhen(at: string): { date: string; time: string } {
  const d = new Date(at)
  const now = new Date()
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()

  return {
    date: sameDay
      ? "Ma"
      : d.toLocaleDateString("hu-HU", {
          month: "2-digit",
          day: "2-digit",
          year: d.getFullYear() !== now.getFullYear() ? "2-digit" : undefined,
        }),
    time: d.toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit" }),
  }
}

export function ProjectOverviewActivityFeed({ items }: ProjectOverviewActivityFeedProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <p className="text-sm font-semibold text-slate-900">Tevékenység napló</p>
      </div>

      {items.length === 0 ? (
        <p className="px-4 py-5 text-center text-sm text-slate-600">Nincs esemény.</p>
      ) : (
        <div className="max-h-80 overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-600">
              <tr className="border-b border-slate-200">
                <th className="whitespace-nowrap px-3 py-2 text-left">Mikor</th>
                <th className="whitespace-nowrap px-3 py-2 text-left">Típus</th>
                <th className="px-3 py-2 text-left">Ki</th>
                <th className="px-3 py-2 text-left">Mit</th>
                <th className="px-3 py-2 text-left">Részlet</th>
              </tr>
            </thead>
            <tbody>
              {items.map((ev) => {
                const when = formatWhen(ev.at)
                return (
                  <tr
                    key={ev.id}
                    className="border-b border-slate-100 hover:bg-slate-50/80 [&_td]:align-top"
                  >
                    <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-600">
                      <span className="font-semibold text-slate-800">{when.date}</span>
                      <span className="ml-1.5 text-slate-500">{when.time}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span
                        className={cn(
                          "rounded-md px-2 py-0.5 text-xs font-bold",
                          KIND_BADGE[ev.kind]
                        )}
                      >
                        {ev.kindLabel}
                      </span>
                    </td>
                    <td className="min-w-[6rem] break-words px-3 py-2.5 font-medium leading-snug text-slate-800">
                      {ev.who}
                    </td>
                    <td className="min-w-[6rem] break-words px-3 py-2.5 font-semibold leading-snug text-slate-950">
                      {ev.action}
                    </td>
                    <td className="min-w-[10rem] break-words px-3 py-2.5 leading-snug text-slate-700">
                      {ev.context ?? "—"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
