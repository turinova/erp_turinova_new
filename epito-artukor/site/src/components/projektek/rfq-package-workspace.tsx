"use client"

import { useMemo, useState } from "react"
import { ChevronDown, ChevronRight, Scale, ArrowLeftRight, Search } from "lucide-react"
import type { Quote, QuoteLine } from "@/types/projects"
import { listDecisionLogsForPackage } from "@/lib/data/projects-store"
import type { PackageSummary } from "@/lib/trade-rfq-summary"
import { computePackageSubmissionTotal } from "@/lib/rfq-package-utils"
import { formatHuf } from "@/lib/pricing"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RfqLineComparisonTable } from "@/components/projektek/rfq-line-comparison-table"
import { RfqPartnerAccessList } from "@/components/projektek/rfq-partner-access-list"

type RfqPackageWorkspaceProps = {
  pkgSummary: PackageSummary
  quoteLines: QuoteLine[]
  projectId: string
  quote: Quote
  onDecide: (packageId: string, intent: "decide" | "change") => void
  onRefresh?: () => void
  defaultCollapsed?: boolean
  isHistory?: boolean
}

export function RfqPackageWorkspace({
  pkgSummary,
  quoteLines,
  projectId,
  quote,
  onDecide,
  onRefresh,
  defaultCollapsed = false,
  isHistory = false,
}: RfqPackageWorkspaceProps) {
  void projectId
  void quote

  const { pkg, invitations, submissions, needsDecision, canChangeWinner, winningInvitation } =
    pkgSummary

  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const [search, setSearch] = useState("")
  const [onlyDiffers, setOnlyDiffers] = useState(false)

  const logs = listDecisionLogsForPackage(pkg.id)

  const winSub = winningInvitation
    ? submissions.find((s) => s.invitationId === winningInvitation.id)
    : null

  const cheapestHint = useMemo(() => {
    let bestName: string | null = null
    let bestTotal = Infinity
    for (const inv of invitations) {
      const sub = submissions.find((s) => s.invitationId === inv.id)
      if (!sub) continue
      const total = computePackageSubmissionTotal(sub, pkg)
      if (total > 0 && total < bestTotal) {
        bestTotal = total
        bestName = inv.subcontractorName
      }
    }
    return bestName && bestTotal < Infinity
      ? { name: bestName, total: bestTotal }
      : null
  }, [invitations, submissions, pkg])

  if (collapsed) {
    return (
      <button
        type="button"
        className="flex w-full items-center gap-1.5 border-t border-slate-100 bg-white px-2.5 py-1.5 text-left text-xs hover:bg-slate-50"
        onClick={() => setCollapsed(false)}
      >
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <span className="min-w-0 flex-1 truncate font-medium text-slate-800">
          {isHistory
            ? `Előzmény · ${winningInvitation?.subcontractorName ?? "—"}`
            : pkg.title}
        </span>
        <span className="shrink-0 text-[11px] text-slate-500">
          {invitations.length} belépő
          {isHistory && winSub ? ` · ${formatHuf(winSub.totalAmount)}` : ""}
          {!isHistory ? ` · ${pkgSummary.submittedCount}/${invitations.length} válasz` : ""}
        </span>
      </button>
    )
  }

  return (
    <div className="border-t border-slate-100 bg-white">
      <div className="flex flex-wrap items-center gap-1.5 px-2.5 py-1.5">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-start gap-1.5 text-left"
          onClick={() => setCollapsed(true)}
          title="Összecsukás"
        >
          <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="min-w-0">
            <span className="block truncate text-xs font-semibold text-slate-950">{pkg.title}</span>
            <span className="block text-[11px] text-slate-600">
              {pkgSummary.submittedCount}/{invitations.length} beküldve
              {cheapestHint ? (
                <>
                  {" "}
                  · Legolcsóbb:{" "}
                  <span className="font-medium text-emerald-800">
                    {cheapestHint.name} ({formatHuf(cheapestHint.total)})
                  </span>
                </>
              ) : null}
              {winningInvitation ? (
                <>
                  {" "}
                  · Nyertes:{" "}
                  <span className="font-medium text-emerald-800">
                    {winningInvitation.subcontractorName}
                  </span>
                </>
              ) : null}
              {" · "}
              {new Date(pkg.expiresAt).toLocaleDateString("hu-HU")}
            </span>
          </span>
        </button>
        {needsDecision ? (
          <Button
            size="sm"
            className="h-7 shrink-0 px-2.5 text-xs font-semibold"
            onClick={() => onDecide(pkg.id, "decide")}
          >
            <Scale className="mr-1 h-3.5 w-3.5" />
            Döntés
            {cheapestHint ? ` · ${cheapestHint.name}` : ""}
          </Button>
        ) : null}
        {canChangeWinner ? (
          <Button
            size="sm"
            variant="outline"
            className="h-7 shrink-0 text-xs"
            onClick={() => onDecide(pkg.id, "change")}
          >
            <ArrowLeftRight className="mr-1 h-3.5 w-3.5" />
            Másik nyertes
          </Button>
        ) : null}
      </div>

      <RfqPartnerAccessList
        invitations={invitations}
        winningInvitationId={winningInvitation?.id ?? null}
        compact
        className="border-x-0 border-b-0"
        onChanged={onRefresh}
        allowDelete={!isHistory}
      />

      {submissions.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 px-2.5 py-1">
            <div className="relative min-w-[10rem] flex-1">
              <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tétel keresése…"
                className="h-7 pl-7 text-xs"
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant={onlyDiffers ? "default" : "outline"}
              className="h-7 text-[11px]"
              onClick={() => setOnlyDiffers((v) => !v)}
            >
              Csak eltérő
            </Button>
          </div>

          <RfqLineComparisonTable
            pkg={pkg}
            quoteLines={quoteLines}
            invitations={invitations}
            submissions={submissions}
            search={search}
            lineFilter={onlyDiffers ? "differs" : "all"}
            maxHeight="min(38vh, 18rem)"
            className="border-x-0 border-b-0"
          />
        </>
      ) : (
        <p className="border-t border-slate-100 px-2.5 py-2 text-center text-[11px] text-slate-600">
          Másold ki a belépőket — még nincs beküldött ajánlat.
        </p>
      )}

      {logs.length > 0 ? (
        <details className="border-t border-slate-100 px-2.5 py-1 text-[11px] text-slate-600">
          <summary className="cursor-pointer font-medium text-slate-700">
            Döntésnapló ({logs.length})
          </summary>
          <ul className="mt-1 space-y-0.5 pb-1">
            {logs.map((log) => (
              <li key={log.id} className="rounded border bg-slate-50 px-1.5 py-1">
                {new Date(log.createdAt).toLocaleString("hu-HU")} —{" "}
                {log.action === "change_package_winner" ? "Nyertes módosítva: " : ""}
                {log.subcontractorName}
                {log.marginPercentAfter != null ? ` · Fedezet: ${log.marginPercentAfter}%` : ""}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  )
}
