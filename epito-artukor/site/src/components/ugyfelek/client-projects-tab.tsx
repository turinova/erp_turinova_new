"use client"

import Link from "next/link"
import { Plus } from "lucide-react"
import type { Client } from "@/types/clients"
import { PROJECT_STATUS_LABELS } from "@/lib/project-labels"
import { listClientProjectRows } from "@/lib/client-queries"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type ClientProjectsTabProps = {
  client: Client
}

export function ClientProjectsTab({ client }: ClientProjectsTabProps) {
  const rows = listClientProjectRows(client)

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-slate-50 px-6 py-12 text-center">
        <p className="text-base font-medium text-slate-700">Még nincs projekt</p>
        <p className="mt-1 text-sm text-slate-500">
          Hozz létre projektet az Árajánlatok oldalon — az ügyfél automatikusan kapcsolódik.
        </p>
        <Button asChild className="mt-4" size="sm" variant="outline">
          <Link href="/ajanlatok">
            <Plus className="mr-1.5 h-4 w-4" />
            Új projekt
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <p className="text-sm font-medium text-slate-700">{rows.length} projekt</p>
        <Button type="button" size="sm" variant="outline" className="h-8 text-xs" asChild>
          <Link href="/ajanlatok">
            <Plus className="mr-1 h-3.5 w-3.5" />
            Új projekt
          </Link>
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="ea-table-head">
            <tr>
              <th className="px-4 py-2.5 text-left">Projekt</th>
              <th className="px-4 py-2.5 text-left">Helyszín</th>
              <th className="px-4 py-2.5 text-left">Árajánlatok</th>
              <th className="px-4 py-2.5 text-left">Státusz</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ project, quoteCount, openQuoteCount }) => (
              <tr key={project.id} className="border-b last:border-b-0 hover:bg-slate-50">
                <td className="px-4 py-2.5">
                  <Link
                    href={`/projektek/${project.id}`}
                    className="font-medium text-slate-900 hover:underline"
                  >
                    {project.name}
                  </Link>
                  <p className="text-sm text-slate-500">{project.code}</p>
                </td>
                <td className="px-4 py-2.5 text-slate-600">{project.siteAddress || "—"}</td>
                <td className="px-4 py-2.5 tabular-nums text-slate-700">
                  {quoteCount}
                  {openQuoteCount > 0 ? (
                    <span className="ml-1 text-xs text-amber-700">({openQuoteCount} nyitott)</span>
                  ) : null}
                </td>
                <td className="px-4 py-2.5">
                  <Badge variant="outline">{PROJECT_STATUS_LABELS[project.status]}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
