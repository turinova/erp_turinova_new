"use client"

import Link from "next/link"
import { ArrowLeft, ClipboardCheck, Lock, Sheet, TrendingUp, User } from "lucide-react"
import type { Quote, QuotePriceSide } from "@/types/projects"
import { QUOTE_STATUS_LABELS } from "@/lib/project-labels"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  QuoteEditorStatusChip,
  type QuoteEditorStatusChipModel,
} from "@/components/projektek/quote-editor-status-chip"
import type { SheetDensity } from "@/lib/quote-sheet-layout"
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
  tools: React.ReactNode
  totals: React.ReactNode
  subNav: React.ReactNode
  subNavExtra?: React.ReactNode
  excelMode?: boolean
  onExcelModeChange?: (next: boolean) => void
  showExcelModeToggle?: boolean
  sheetDensity?: SheetDensity
  onSheetDensityChange?: (next: SheetDensity) => void
  showSheetDensityToggle?: boolean
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
  tools,
  totals,
  subNav,
  subNavExtra,
  excelMode = false,
  onExcelModeChange,
  showExcelModeToggle = false,
  sheetDensity = "compact",
  onSheetDensityChange,
  showSheetDensityToggle = false,
}: QuoteEditorCommandBarProps) {
  const lockedTabClass =
    "cursor-not-allowed opacity-45 hover:bg-transparent data-[disabled]:opacity-45"

  return (
    <div className="sticky top-0 z-20 shrink-0 border-b border-slate-200 bg-[var(--background)]">
      <div className="flex min-h-10 items-center gap-2 overflow-x-auto py-1">
        <div className="flex min-w-0 max-w-[38%] shrink-0 items-center gap-1.5">
          <Link
            href={`/projektek/${projectId}?tab=quotes`}
            className="inline-flex shrink-0 items-center text-xs text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="mr-0.5 h-3.5 w-3.5" />
            <span className="max-w-[6rem] truncate sm:max-w-[9rem]">{projectName}</span>
          </Link>
          <span className="shrink-0 text-slate-300">·</span>
          <h1 className="truncate text-sm font-semibold text-slate-900">{quoteTitle}</h1>
          {tradeLabel ? (
            <Badge variant="outline" className="shrink-0 text-[10px] font-normal text-slate-700">
              {tradeLabel}
            </Badge>
          ) : null}
          <span className="shrink-0 text-[10px] text-slate-500">
            {QUOTE_STATUS_LABELS[quoteStatus]}
          </span>
        </div>

        <QuoteEditorStatusChip model={statusChip} />

        <div className="flex shrink-0 rounded-md border bg-white p-0.5 shadow-sm">
          {executionMode ? (
            <Button
              type="button"
              size="sm"
              variant={editorTab === "execution" ? "default" : "ghost"}
              className="h-7 gap-1 px-2 text-xs leading-none"
              onClick={() => onEditorTabChange("execution")}
            >
              <ClipboardCheck className="h-3 w-3 shrink-0" />
              Kivitelezés
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant={editorTab === "cost" ? "default" : "ghost"}
            className="h-7 gap-1 px-2 text-xs leading-none"
            onClick={() => onEditorTabChange("cost")}
          >
            <Lock className="h-3 w-3 shrink-0" />
            Bekerülés
          </Button>
          <Button
            type="button"
            size="sm"
            variant={editorTab === "markup" ? "default" : "ghost"}
            className={cn(
              "h-7 gap-1 px-2 text-xs leading-none",
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
            <TrendingUp className="h-3 w-3 shrink-0" />
            Fedezet
            {contractPriceLocked ? <Lock className="h-2.5 w-2.5 opacity-60" /> : null}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={editorTab === "sell" ? "default" : "ghost"}
            className={cn(
              "h-7 gap-1 px-2 text-xs leading-none",
              contractPriceLocked && editorTab !== "sell" && "opacity-90"
            )}
            onClick={() => onEditorTabChange("sell")}
            title={
              contractPriceLocked
                ? "Szerződött ügyfélár — csak megtekintés"
                : undefined
            }
          >
            <User className="h-3 w-3 shrink-0" />
            Ügyfél
            {contractPriceLocked ? <Lock className="h-2.5 w-2.5 opacity-60" /> : null}
          </Button>
        </div>

        {showExcelModeToggle && onExcelModeChange ? (
          <Button
            type="button"
            size="sm"
            variant={excelMode ? "default" : "outline"}
            className="h-7 shrink-0 gap-1 px-2 text-xs"
            onClick={() => onExcelModeChange(!excelMode)}
            title="Teljes képernyős táblázat — RFQ panel elrejtése"
          >
            <Sheet className="h-3 w-3" />
            Excel mód
          </Button>
        ) : null}

        {showSheetDensityToggle && onSheetDensityChange ? (
          <Button
            type="button"
            size="sm"
            variant={sheetDensity === "normal" ? "default" : "outline"}
            className="h-7 shrink-0 px-2 text-xs"
            onClick={() =>
              onSheetDensityChange(sheetDensity === "normal" ? "compact" : "normal")
            }
            title="Normál sor magasság és betűméret"
          >
            {sheetDensity === "normal" ? "Normál" : "Kompakt"}
          </Button>
        ) : null}

        {tools ? (
          <div className="flex h-7 min-w-0 shrink-0 items-center gap-1">{tools}</div>
        ) : null}

        <div className="ml-auto hidden min-w-0 shrink-0 text-right text-xs tabular-nums sm:block sm:min-w-[11rem] lg:min-w-[16rem]">
          {totals}
        </div>
      </div>

      {executionMode && editorTab === "execution" ? (
        <div className="border-t border-slate-100 px-2 py-1.5 text-xs tabular-nums text-slate-700 sm:hidden">
          {totals}
        </div>
      ) : null}

      {subNav ? (
        <div className="flex items-center gap-2 pt-0.5">{subNav}</div>
      ) : null}

      {subNavExtra ? <div className="pb-0.5">{subNavExtra}</div> : null}
    </div>
  )
}
