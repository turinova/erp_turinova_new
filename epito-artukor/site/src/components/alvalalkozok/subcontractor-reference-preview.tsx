"use client"

import type { SubcontractorReference } from "@/types/subcontractors"
import { getTradeLabel } from "@/lib/trades"
import type { Trade } from "@/types"

type SubcontractorReferencePreviewProps = {
  references: SubcontractorReference[]
  maxItems?: number
  onViewAll?: () => void
}

export function SubcontractorReferencePreview({
  references,
  maxItems = 3,
  onViewAll,
}: SubcontractorReferencePreviewProps) {
  const sorted = [...references].sort((a, b) => a.sortOrder - b.sortOrder)
  const visible = sorted.slice(0, maxItems)
  const hasMore = sorted.length > maxItems

  return (
    <section className="border-t border-slate-100 px-5 py-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Referenciák
        </p>
        {hasMore && onViewAll ? (
          <button
            type="button"
            onClick={onViewAll}
            className="text-xs font-semibold text-blue-700 hover:underline"
          >
            Összes ({sorted.length})
          </button>
        ) : null}
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-slate-600">
          Még nincs referencia.{" "}
          {onViewAll ? (
            <button
              type="button"
              onClick={onViewAll}
              className="font-medium text-blue-700 hover:underline"
            >
              Hozzáadás
            </button>
          ) : null}
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((ref) => (
            <li key={ref.id} className="text-sm">
              <span className="font-medium text-slate-900">{ref.title}</span>
              <span className="text-slate-500">
                {" "}
                —{" "}
                {[ref.projectName, ref.year, ref.trade ? getTradeLabel(ref.trade as Trade) : null]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
