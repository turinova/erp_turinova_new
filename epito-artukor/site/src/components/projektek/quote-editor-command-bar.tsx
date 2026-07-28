"use client"

import Link from "next/link"
import { ArrowLeft, Lock } from "lucide-react"
import type { Quote, QuotePriceSide } from "@/types/projects"
import { QUOTE_STATUS_LABELS } from "@/lib/project-labels"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  QuoteEditorStatusChip,
  type QuoteEditorStatusChipModel,
} from "@/components/projektek/quote-editor-status-chip"
import { cn } from "@/lib/utils"

export type QuoteEditorTab = QuotePriceSide | "execution"

type QuoteEditorCommandBarProps = {
  projectId: string
  projectName: string
  quoteTitle: string
  tradeLabel?: string
  quoteStatus: Quote["status"]
  editorTab: QuoteEditorTab
  onEditorTabChange: (tab: QuoteEditorTab) => void
  executionMode?: boolean
  contractPriceLocked?: boolean
  statusChip: QuoteEditorStatusChipModel
  onStatusChipClick?: () => void
  tools: React.ReactNode
  totals: React.ReactNode
  subNav: React.ReactNode
  subNavExtra?: React.ReactNode
}

export function QuoteEditorCommandBar({
  projectId,
  projectName,
  quoteTitle,
  tradeLabel,
  quoteStatus,
  editorTab,
  onEditorTabChange,
  executionMode = false,
  contractPriceLocked = false,
  statusChip,
  onStatusChipClick,
  tools,
  totals,
  subNav,
  subNavExtra,
}: QuoteEditorCommandBarProps) {
  const lockedTabClass =
    "cursor-not-allowed opacity-45 hover:bg-transparent data-[disabled]:opacity-45"

  const titleEqualsTrade =
    !!tradeLabel &&
    quoteTitle.trim().toLocaleLowerCase("hu") === tradeLabel.trim().toLocaleLowerCase("hu")

  const heading = titleEqualsTrade ? tradeLabel : quoteTitle
  const showTradeChip = !!tradeLabel && !titleEqualsTrade

  return (
    <div className="sticky top-0 z-20 shrink-0 border-b border-slate-200 bg-[var(--background)]">
      {/* 1. sor: hol vagyok + összeg */}
      <div className="flex min-h-9 items-center gap-2 px-0.5 py-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <Link
            href={`/projektek/${projectId}?tab=quotes`}
            className="inline-flex shrink-0 items-center text-xs text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="mr-0.5 h-3.5 w-3.5" />
            <span className="max-w-[6rem] truncate sm:max-w-[10rem]">{projectName}</span>
          </Link>
          <span className="shrink-0 text-slate-300">·</span>
          <h1 className="min-w-0 truncate text-sm font-semibold text-slate-900">{heading}</h1>
          {showTradeChip ? (
            <Badge variant="outline" className="shrink-0 text-[10px] font-normal text-slate-700">
              {tradeLabel}
            </Badge>
          ) : null}
          <span className="hidden shrink-0 text-[10px] text-slate-500 sm:inline">
            {QUOTE_STATUS_LABELS[quoteStatus]}
          </span>
          <QuoteEditorStatusChip
            model={statusChip}
            onClick={onStatusChipClick}
            className="ml-0.5"
          />
        </div>

        <div className="ml-auto hidden min-w-0 shrink-0 text-right sm:block sm:min-w-[10rem]">
          {totals}
        </div>
      </div>

      {/* 2. sor: mit csinálok */}
      <div className="flex min-h-8 items-center gap-2 overflow-x-auto pb-1.5">
        <div className="flex shrink-0 rounded-md border bg-white p-0.5 shadow-sm">
          {executionMode ? (
            <Button
              type="button"
              size="sm"
              variant={editorTab === "execution" ? "default" : "ghost"}
              className="h-7 px-2.5 text-xs leading-none"
              onClick={() => onEditorTabChange("execution")}
            >
              Kivitelezés
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant={editorTab === "cost" ? "default" : "ghost"}
            className="h-7 px-2.5 text-xs leading-none"
            onClick={() => onEditorTabChange("cost")}
          >
            Bekerülés
          </Button>
          <Button
            type="button"
            size="sm"
            variant={editorTab === "markup" ? "default" : "ghost"}
            className={cn(
              "h-7 gap-1 px-2.5 text-xs leading-none",
              contractPriceLocked && editorTab !== "markup" && lockedTabClass
            )}
            onClick={() => {
              if (contractPriceLocked) return
              onEditorTabChange("markup")
            }}
            disabled={contractPriceLocked}
            title={
              contractPriceLocked
                ? "Szerződött ár — csak új árajánlattal módosítható"
                : undefined
            }
          >
            Fedezet
            {contractPriceLocked ? <Lock className="h-2.5 w-2.5 opacity-60" /> : null}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={editorTab === "sell" ? "default" : "ghost"}
            className={cn(
              "h-7 gap-1 px-2.5 text-xs leading-none",
              contractPriceLocked && editorTab !== "sell" && "opacity-90"
            )}
            onClick={() => onEditorTabChange("sell")}
            title={
              contractPriceLocked
                ? "Szerződött ügyfélár — csak megtekintés"
                : undefined
            }
          >
            Ügyfél ár
            {contractPriceLocked ? <Lock className="h-2.5 w-2.5 opacity-60" /> : null}
          </Button>
        </div>

        {tools ? (
          <div className="flex h-7 min-w-0 shrink-0 items-center gap-1">{tools}</div>
        ) : null}

        {subNav ? (
          <div className="flex min-w-0 flex-1 items-center gap-2">{subNav}</div>
        ) : null}
      </div>

      <div className="border-t border-slate-100 px-0.5 py-1.5 text-xs tabular-nums text-slate-700 sm:hidden">
        {totals}
      </div>

      {subNavExtra ? <div className="pb-1.5">{subNavExtra}</div> : null}
    </div>
  )
}
