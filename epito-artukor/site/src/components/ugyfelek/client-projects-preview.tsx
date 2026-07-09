"use client"

import Link from "next/link"
import type { Client } from "@/types/clients"
import { PROJECT_STATUS_LABELS } from "@/lib/project-labels"
import { listClientProjectRows } from "@/lib/client-queries"

type ClientProjectsPreviewProps = {
  client: Client
  maxItems?: number
  onViewAll?: () => void
}

export function ClientProjectsPreview({
  client,
  maxItems = 3,
  onViewAll,
}: ClientProjectsPreviewProps) {
  const rows = listClientProjectRows(client)
  const visible = rows.slice(0, maxItems)
  const hasMore = rows.length > maxItems

  return (
    <section className="border-t border-slate-100 px-5 py-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Projektek</p>
        {hasMore && onViewAll ? (
          <button
            type="button"
            onClick={onViewAll}
            className="text-xs font-semibold text-blue-700 hover:underline"
          >
            Összes ({rows.length})
          </button>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-600">
          Még nincs projekt.{" "}
          <Link href="/ajanlatok" className="font-medium text-blue-700 hover:underline">
            Új projekt
          </Link>
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map(({ project, quoteCount, openQuoteCount }) => (
            <li key={project.id} className="text-sm">
              <Link
                href={`/projektek/${project.id}`}
                className="font-medium text-slate-900 hover:underline"
              >
                {project.name}
              </Link>
              <span className="text-slate-500">
                {" "}
                — {project.code} · {PROJECT_STATUS_LABELS[project.status]}
                {quoteCount > 0 ? ` · ${quoteCount} ajánlat` : ""}
                {openQuoteCount > 0 ? ` (${openQuoteCount} nyitott)` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
