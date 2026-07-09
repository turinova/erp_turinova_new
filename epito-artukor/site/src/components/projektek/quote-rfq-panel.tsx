"use client"

import { useMemo, useState } from "react"
import { ArrowLeftRight, Scale } from "lucide-react"
import type { Quote, QuoteLine } from "@/types/projects"
import { formatHuf } from "@/lib/pricing"
import {
  findCheapestPackageInvitation,
  listRfqPackagesForQuoteEditor,
} from "@/lib/quote-rfq-context"
import { computePackageSubmissionTotal, getInvitationSubmission } from "@/lib/rfq-package-utils"
import { Button } from "@/components/ui/button"
import {
  QuoteRfqDecisionDialog,
  type QuoteRfqDecisionIntent,
} from "@/components/projektek/quote-rfq-decision-dialog"

type QuoteRfqPanelProps = {
  quote: Quote
  quoteId: string
  lines: QuoteLine[]
  onRefresh: () => void
}

type DialogState = {
  pkgId: string
  intent: QuoteRfqDecisionIntent
} | null

export function QuoteRfqPanel({ quote, quoteId, lines, onRefresh }: QuoteRfqPanelProps) {
  const packages = useMemo(
    () => listRfqPackagesForQuoteEditor(quoteId, lines),
    [quoteId, lines]
  )
  const [dialog, setDialog] = useState<DialogState>(null)

  const active = useMemo(
    () => packages.find((p) => p.pkg.id === dialog?.pkgId) ?? null,
    [packages, dialog]
  )

  if (packages.length === 0) return null

  return (
    <>
      <div className="mb-0.5 space-y-1">
        {packages.map((row) => {
          const { pkg, invitations, submissions, submissionCount, needsDecision, canChangeWinner } =
            row
          const cheapestId = findCheapestPackageInvitation(pkg, invitations, submissions)
          const cheapestInv = invitations.find((i) => i.id === cheapestId)
          const cheapestSub = cheapestId
            ? getInvitationSubmission(cheapestId, submissions)
            : undefined
          const cheapestTotal = cheapestSub
            ? computePackageSubmissionTotal(cheapestSub, pkg)
            : 0

          if (needsDecision) {
            return (
              <div
                key={pkg.id}
                className="flex flex-wrap items-center gap-2 rounded-md border border-blue-200 bg-blue-50/90 px-2.5 py-1.5"
              >
                <p className="min-w-0 flex-1 text-xs text-blue-950">
                  <span className="font-semibold">{pkg.title}</span>
                  <span className="text-blue-800">
                    {" "}
                    · {submissionCount} ajánlat
                    {cheapestInv && cheapestTotal > 0
                      ? ` · legolcsóbb: ${cheapestInv.subcontractorName} (${formatHuf(cheapestTotal)})`
                      : ""}
                  </span>
                </p>
                <Button
                  size="sm"
                  className="h-7 shrink-0 px-2 text-xs"
                  onClick={() => setDialog({ pkgId: pkg.id, intent: "decide" })}
                >
                  <Scale className="mr-1 h-3.5 w-3.5" />
                  Összehasonlítás és döntés
                </Button>
              </div>
            )
          }

          if (canChangeWinner) {
            return (
              <div
                key={pkg.id}
                className="flex flex-wrap items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50/80 px-2.5 py-1.5"
              >
                <p className="min-w-0 flex-1 text-xs text-emerald-950">
                  <span className="font-semibold">{pkg.title}</span>
                  <span className="text-emerald-800">
                    {" "}
                    · Nyertes: {row.winningSubcontractorName}
                    {submissionCount > 1 ? ` · ${submissionCount} ajánlat összesen` : ""}
                  </span>
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 shrink-0 border-emerald-300 bg-white px-2 text-xs text-emerald-900 hover:bg-emerald-50"
                  onClick={() => setDialog({ pkgId: pkg.id, intent: "change" })}
                >
                  <ArrowLeftRight className="mr-1 h-3.5 w-3.5" />
                  Másik ajánlat
                </Button>
              </div>
            )
          }

          return null
        })}
      </div>

      {active && dialog ? (
        <QuoteRfqDecisionDialog
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null)
          }}
          intent={dialog.intent}
          pkg={active.pkg}
          quote={quote}
          quoteLines={lines}
          invitations={active.invitations}
          submissions={active.submissions}
          winningInvitationId={active.winningInvitationId}
          onApplied={() => {
            onRefresh()
            setDialog(null)
          }}
        />
      ) : null}
    </>
  )
}
