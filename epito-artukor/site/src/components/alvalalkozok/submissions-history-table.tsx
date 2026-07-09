"use client"

import Link from "next/link"
import type { SubcontractorSubmissionRow } from "@/lib/subcontractor-queries"
import { formatHuf } from "@/lib/pricing"
import { Badge } from "@/components/ui/badge"
import { ExternalLink } from "lucide-react"

type SubmissionsHistoryTableProps = {
  rows: SubcontractorSubmissionRow[]
}

const statusTone: Record<
  SubcontractorSubmissionRow["invitationStatus"],
  "default" | "secondary" | "success" | "warning" | "outline"
> = {
  invited: "outline",
  submitted: "secondary",
  accepted: "success",
  rejected: "warning",
}

export function SubmissionsHistoryTable({ rows }: SubmissionsHistoryTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-slate-50 px-6 py-12 text-center">
        <p className="text-base font-medium text-slate-700">Még nincs beküldött ajánlat</p>
        <p className="mt-1 text-sm text-slate-500">
          Ha RFQ-n meghívod és válaszol, itt jelenik meg a teljes történet.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="ea-table-head">
            <tr>
              <th className="px-4 py-2.5 text-left">Beküldve</th>
              <th className="px-4 py-2.5 text-left">Projekt</th>
              <th className="px-4 py-2.5 text-left">Bekérés</th>
              <th className="px-4 py-2.5 text-left">Szakág</th>
              <th className="px-4 py-2.5 text-right">Összeg</th>
              <th className="px-4 py-2.5 text-left">Státusz</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.submissionId} className="border-b last:border-b-0 hover:bg-slate-50">
                <td className="px-4 py-2.5 text-base text-slate-600">
                  {new Date(row.submittedAt).toLocaleDateString("hu-HU")}
                </td>
                <td className="px-4 py-2.5">
                  <p className="font-medium text-slate-900">{row.projectName}</p>
                  <p className="text-sm text-slate-500">{row.projectCode}</p>
                </td>
                <td className="px-4 py-2.5 text-base text-slate-700">{row.packageTitle}</td>
                <td className="px-4 py-2.5 text-base text-slate-600">{row.tradeLabel}</td>
                <td className="px-4 py-2.5 text-right text-base font-medium tabular-nums text-slate-900">
                  {formatHuf(row.totalAmount)}
                </td>
                <td className="px-4 py-2.5">
                  <Badge variant={statusTone[row.invitationStatus]} className="font-normal">
                    {row.invitationStatusLabel}
                  </Badge>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Link
                    href={`/projektek/${row.projectId}?tab=rfq`}
                    className="inline-flex items-center text-sm text-blue-600 hover:underline"
                  >
                    Projekt
                    <ExternalLink className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
