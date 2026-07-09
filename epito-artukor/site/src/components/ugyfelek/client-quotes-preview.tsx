"use client"

import Link from "next/link"
import type { Client } from "@/types/clients"
import { QUOTE_STATUS_LABELS } from "@/lib/project-labels"
import { listClientQuoteRows } from "@/lib/client-queries"

type ClientQuotesPreviewProps = {
  client: Client
  maxItems?: number
}

export function ClientQuotesPreview({ client, maxItems = 4 }: ClientQuotesPreviewProps) {
  const rows = listClientQuoteRows(client).slice(0, maxItems)

  return (
    <section className="border-t border-slate-100 px-5 py-3.5">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Legutóbbi ajánlatok
      </p>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-600">Még nincs árajánlat ehhez az ügyfélhez.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map(({ quote, project, grossFormatted }) => (
            <li key={quote.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm">
              <div className="min-w-0">
                <Link
                  href={`/projektek/${project.id}/ajanlat/${quote.id}`}
                  className="font-medium text-slate-900 hover:underline"
                >
                  {quote.title}
                </Link>
                <span className="text-slate-500">
                  {" "}
                  — {project.code} · {QUOTE_STATUS_LABELS[quote.status]}
                </span>
              </div>
              <span className="shrink-0 tabular-nums font-medium text-slate-800">{grossFormatted}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
