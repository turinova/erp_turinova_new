"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  Scale,
  ArrowLeftRight,
  Search,
} from "lucide-react"
import { toast } from "sonner"
import type { Quote, QuoteLine } from "@/types/projects"
import { RFQ_INVITATION_STATUS_LABELS, RFQ_STATUS_LABELS } from "@/lib/project-labels"
import { listDecisionLogsForPackage } from "@/lib/data/projects-store"
import type { PackageSummary } from "@/lib/trade-rfq-summary"
import {
  buildRfqComparisonRows,
  buildRfqPackageKpis,
  type RfqLineFilter,
} from "@/lib/rfq-line-comparison"
import { computePackageSubmissionTotal, getInvitationSubmission } from "@/lib/rfq-package-utils"
import { formatHuf } from "@/lib/pricing"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { RfqLineComparisonTable } from "@/components/projektek/rfq-line-comparison-table"
import { cn } from "@/lib/utils"

const LINE_FILTERS: Array<{ id: RfqLineFilter; label: string }> = [
  { id: "all", label: "Mind" },
  { id: "differs", label: "Eltérés" },
  { id: "missing", label: "Hiányzó ár" },
  { id: "catalog_diff", label: ">10% ártükör" },
]

type RfqPackageWorkspaceProps = {
  pkgSummary: PackageSummary
  quoteLines: QuoteLine[]
  projectId: string
  quote: Quote
  onDecide: (packageId: string, intent: "decide" | "change") => void
  defaultCollapsed?: boolean
  isHistory?: boolean
}

function PartnerChip({
  name,
  status,
  total,
  accessToken,
  accessCode,
}: {
  name: string
  status: string
  total: number | null
  accessToken: string
  accessCode: string
}) {
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/rfq/${accessToken}`
      : `/rfq/${accessToken}`

  return (
    <div className="inline-flex items-center gap-1 rounded-full border bg-white py-0.5 pl-2.5 pr-1 text-xs shadow-sm">
      <span className="max-w-[8rem] truncate font-medium text-slate-800">{name}</span>
      <span className="text-slate-500">{status}</span>
      {total != null && total > 0 ? (
        <span className="tabular-nums font-semibold text-slate-900">{formatHuf(total)}</span>
      ) : null}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-6 w-6 p-0 text-slate-500"
        title="Link másolása"
        onClick={() => {
          navigator.clipboard.writeText(`${name}\n${url}\nKód: ${accessCode}`)
          toast.success("Link másolva")
        }}
      >
        <Copy className="h-3 w-3" />
      </Button>
      <Button type="button" size="sm" variant="ghost" className="h-6 w-6 p-0 text-slate-500" asChild>
        <a href={url} target="_blank" rel="noreferrer" title="Előnézet">
          <ExternalLink className="h-3 w-3" />
        </a>
      </Button>
    </div>
  )
}

export function RfqPackageWorkspace({
  pkgSummary,
  quoteLines,
  projectId,
  quote,
  onDecide,
  defaultCollapsed = false,
  isHistory = false,
}: RfqPackageWorkspaceProps) {
  const { pkg, invitations, submissions, roundIndex, needsDecision, canChangeWinner, winningInvitation } =
    pkgSummary

  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const [search, setSearch] = useState("")
  const [lineFilter, setLineFilter] = useState<RfqLineFilter>("all")
  const [compact, setCompact] = useState(true)
  const [compareIds, setCompareIds] = useState<string[] | null>(null)

  const submittedInvitations = useMemo(
    () => invitations.filter((inv) => submissions.some((s) => s.invitationId === inv.id)),
    [invitations, submissions]
  )

  const quoteLineOrder = useMemo(() => {
    const map = new Map<string, number>()
    quoteLines.forEach((l, i) => map.set(l.id, i))
    return map
  }, [quoteLines])

  const allRows = useMemo(
    () =>
      buildRfqComparisonRows(pkg, quoteLines, submittedInvitations, submissions, quoteLineOrder),
    [pkg, quoteLines, submittedInvitations, submissions, quoteLineOrder]
  )

  const kpis = useMemo(
    () => buildRfqPackageKpis(pkg, submittedInvitations, submissions, allRows),
    [pkg, submittedInvitations, submissions, allRows]
  )

  const logs = listDecisionLogsForPackage(pkg.id)
  const daysLeft = Math.ceil(
    (new Date(pkg.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )

  const winSub = winningInvitation
    ? submissions.find((s) => s.invitationId === winningInvitation.id)
    : null

  const summaryLine = isHistory
    ? `${winningInvitation?.subcontractorName ?? "—"}${winSub ? ` · ${formatHuf(winSub.totalAmount)}` : ""}`
    : `${pkgSummary.submittedCount}/${invitations.length} válasz · ${pkg.lines.length} tétel`

  if (collapsed) {
    return (
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-lg border bg-white px-3 py-2 text-left text-sm hover:bg-slate-50"
        onClick={() => setCollapsed(false)}
      >
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
        <Badge variant="outline" className="shrink-0 text-[10px]">
          {roundIndex}. kör
        </Badge>
        <Badge variant={pkg.status === "decided" ? "success" : "outline"} className="shrink-0 text-[10px]">
          {RFQ_STATUS_LABELS[pkg.status] ?? pkg.status}
        </Badge>
        <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{pkg.title}</span>
        <span className="shrink-0 text-xs text-slate-500">{summaryLine}</span>
      </button>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b bg-slate-50/80 px-3 py-2">
        <button
          type="button"
          className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          onClick={() => setCollapsed(true)}
          aria-label="Összecsukás"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
        <Badge variant="outline" className="text-[10px]">
          {roundIndex}. kör
        </Badge>
        <Badge variant={pkg.status === "decided" ? "success" : "warning"} className="text-[10px]">
          {RFQ_STATUS_LABELS[pkg.status] ?? pkg.status}
        </Badge>
        <h4 className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{pkg.title}</h4>
        <span className="text-xs text-slate-500">
          {summaryLine}
          {pkg.status !== "decided" && !isHistory ? (
            <>
              {" "}
              · {new Date(pkg.expiresAt).toLocaleDateString("hu-HU")}
              {daysLeft >= 0 ? ` (${daysLeft} nap)` : " (lejárt)"}
            </>
          ) : null}
        </span>
        <div className="flex flex-wrap gap-1">
          {needsDecision ? (
            <Button size="sm" className="h-7 text-xs" onClick={() => onDecide(pkg.id, "decide")}>
              <Scale className="mr-1 h-3 w-3" />
              Döntés
            </Button>
          ) : null}
          {canChangeWinner ? (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => onDecide(pkg.id, "change")}
            >
              <ArrowLeftRight className="mr-1 h-3 w-3" />
              Másik ajánlat
            </Button>
          ) : null}
          <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
            <Link href={`/projektek/${projectId}/ajanlat/${quote.id}`}>Költségvetés</Link>
          </Button>
        </div>
      </div>

      {submissions.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 border-b bg-white px-3 py-2 sm:grid-cols-4">
          <KpiCell
            label="Legolcsóbb"
            value={kpis.cheapestTotal != null ? formatHuf(kpis.cheapestTotal) : "—"}
          />
          <KpiCell
            label="Különbség"
            value={kpis.spread != null && kpis.spread > 0 ? formatHuf(kpis.spread) : "—"}
          />
          <KpiCell label="Árazott sor" value={`${kpis.pricedLineCount} / ${kpis.totalLines}`} />
          <KpiCell
            label="Eltérő sor"
            value={kpis.differsCount > 0 ? String(kpis.differsCount) : "—"}
            highlight={kpis.differsCount > 0}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        {invitations.map((inv) => {
          const sub = submissions.find((s) => s.invitationId === inv.id)
          const total = sub ? computePackageSubmissionTotal(sub, pkg) : null
          return (
            <PartnerChip
              key={inv.id}
              name={inv.subcontractorName}
              status={RFQ_INVITATION_STATUS_LABELS[inv.status]}
              total={total}
              accessToken={inv.accessToken}
              accessCode={inv.accessCode}
            />
          )
        })}
      </div>

      {submissions.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center gap-2 border-b bg-slate-50/50 px-3 py-2">
            <div className="relative min-w-[10rem] flex-1">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Keresés azonosító / szöveg…"
                className="h-8 pl-8 text-xs"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {LINE_FILTERS.map((f) => (
                <Button
                  key={f.id}
                  type="button"
                  size="sm"
                  variant={lineFilter === f.id ? "default" : "outline"}
                  className="h-7 px-2 text-[11px] font-normal"
                  onClick={() => setLineFilter(f.id)}
                >
                  {f.label}
                </Button>
              ))}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              onClick={() => setCompact((v) => !v)}
            >
              {compact ? "Részletes" : "Kompakt"}
            </Button>
            {submittedInvitations.length > 2 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-[11px]"
                onClick={() => setCompareIds(compareIds ? null : submittedInvitations.slice(0, 2).map((i) => i.id))}
              >
                {compareIds ? "Minden ajánlat" : "2 ajánlat párosítás"}
              </Button>
            ) : null}
          </div>

          <div className="p-2">
            <RfqLineComparisonTable
              pkg={pkg}
              quoteLines={quoteLines}
              invitations={invitations}
              submissions={submissions}
              search={search}
              lineFilter={lineFilter}
              compact={compact}
              visibleInvitationIds={compareIds}
              maxHeight="32rem"
              footerLabel={`${pkg.title} — összesítő`}
            />
          </div>
        </>
      ) : (
        <p className="px-4 py-6 text-center text-sm text-slate-600">
          Küldd ki a linkeket — még nincs beküldött ajánlat.
        </p>
      )}

      {logs.length > 0 ? (
        <details className="border-t px-3 py-2 text-xs text-slate-600">
          <summary className="cursor-pointer font-medium text-slate-700">Döntésnapló ({logs.length})</summary>
          <ul className="mt-2 space-y-1">
            {logs.map((log) => (
              <li key={log.id} className="rounded border bg-slate-50 px-2 py-1.5">
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

function KpiCell({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-md border px-2.5 py-1.5",
        highlight ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="tabular-nums text-sm font-semibold text-slate-900">{value}</p>
    </div>
  )
}
