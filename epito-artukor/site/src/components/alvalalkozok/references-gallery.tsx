"use client"

import type { SubcontractorReference } from "@/types/subcontractors"
import { getTradeLabel } from "@/lib/trades"
import type { Trade } from "@/types"
import { FileText } from "lucide-react"

type ReferencesGalleryProps = {
  references: SubcontractorReference[]
}

export function ReferencesGallery({ references }: ReferencesGalleryProps) {
  const sorted = [...references].sort((a, b) => a.sortOrder - b.sortOrder)

  if (sorted.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center">
        <FileText className="mx-auto h-8 w-8 text-slate-300" />
        <p className="mt-2 text-sm font-medium text-slate-700">Még nincs referencia</p>
        <p className="mt-1 text-sm text-slate-500">
          Adj hozzá korábbi projekteket — így könnyebb dönteni meghíváskor.
        </p>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
      {sorted.map((ref) => (
        <li key={ref.id} className="px-4 py-3.5">
          <p className="font-medium text-slate-900">{ref.title}</p>
          <p className="mt-0.5 text-sm text-slate-500">
            {[ref.projectName, ref.year, ref.trade ? getTradeLabel(ref.trade as Trade) : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {ref.description ? (
            <p className="mt-1.5 text-sm leading-snug text-slate-600">{ref.description}</p>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
