"use client"

import dynamic from "next/dynamic"
import { useEffect, useMemo, useState, type CSSProperties } from "react"
import Link from "next/link"
import {
  BookOpen,
  MoreHorizontal,
  Plus,
  Send,
} from "lucide-react"
import { toast } from "sonner"
import type { QuotePriceSide, QuoteVatMode } from "@/types/projects"
import type { CostItem, Trade } from "@/types"
import { isQuoteInExecutionMode, computeQuoteExecutionStats, computeExecutionFinancialTotals, buildContractedSellMap } from "@/lib/quote-execution"
import { loadCostItems } from "@/lib/data/cost-items-store"
import {
  addManualQuoteLine,
  addQuoteLineFromCostItem,
  applyCatalogPricesToLine,
  applyCatalogToUnpricedLines,
  getProject,
  getQuote,
  listQuoteLines,
  updateQuote,
  updateQuoteLine,
} from "@/lib/data/projects-store"
import { matchesFuzzySearch } from "@/lib/cost-item-search"
import {
  countUnpricedLines,
  quoteCostTotals,
  quoteSellTotals,
} from "@/lib/quote-utils"
import { inferPrimaryTrade } from "@/lib/project-quote-aggregation"
import { getQuoteContractContext } from "@/lib/quote-contract-context"
import { getTradeLabel } from "@/lib/trades"
import { formatHuf } from "@/lib/pricing"
import { findNavItemByHref } from "@/lib/nav-config"
import { listHrefForProject } from "@/lib/project-phase"
import {
  QUOTE_VAT_OPTIONS,
  buildClientQuoteReadiness,
  buildQuoteTradeBreakdown,
  calcQuoteVatTotals,
  resolveQuoteVatMode,
} from "@/lib/quote-client-summary"
import { loadUnits, unitMap } from "@/lib/data/units-store"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  costSourceFilterDotKind,
  costSourceKindDotClass,
  countLinesByVisualKind,
  matchesCostSourceFilter,
  type CostSourceFilter,
} from "@/lib/quote-line-visual"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { QuoteEditorCommandBar, type QuoteEditorTab } from "@/components/projektek/quote-editor-command-bar"
import type { QuoteClientSubView } from "@/components/projektek/quote-client-panel"
import { QuoteCostSpreadsheet } from "@/components/projektek/quote-cost-spreadsheet"
import type { SheetDensity } from "@/lib/quote-sheet-layout"
import {
  buildQuoteEditorStatusChip,
} from "@/components/projektek/quote-editor-status-chip"
import { useProjectBundleLoaded } from "@/hooks/use-project-bundle-loaded"
import { ensureCostItemsLoaded } from "@/lib/data/master-data-primer"
import { cn } from "@/lib/utils"

const QuoteRfqPanel = dynamic(
  () => import("@/components/projektek/quote-rfq-panel").then((m) => m.QuoteRfqPanel),
  { loading: () => <p className="p-4 text-sm text-slate-500">RFQ panel betöltése…</p> }
)
const QuoteMarkupPanel = dynamic(
  () => import("@/components/projektek/quote-markup-panel").then((m) => m.QuoteMarkupPanel),
  { loading: () => <p className="p-4 text-sm text-slate-500">Árrés panel betöltése…</p> }
)
const QuoteClientPanel = dynamic(
  () => import("@/components/projektek/quote-client-panel").then((m) => m.QuoteClientPanel),
  { loading: () => <p className="p-4 text-sm text-slate-500">Ügyfél panel betöltése…</p> }
)
const QuoteExecutionPanel = dynamic(
  () => import("@/components/projektek/quote-execution-panel").then((m) => m.QuoteExecutionPanel),
  { loading: () => <p className="p-4 text-sm text-slate-500">Kivitelezés panel betöltése…</p> }
)

type QuoteEditorClientProps = {
  projectId: string
  quoteId: string
}

export function QuoteEditorClient({ projectId, quoteId }: QuoteEditorClientProps) {
  const editorReady = useProjectBundleLoaded(projectId)
  const [costItemsReady, setCostItemsReady] = useState(false)
  const [tick, setTick] = useState(0)
  const [editorTab, setEditorTab] = useState<QuoteEditorTab>("cost")
  const [tabBootstrapped, setTabBootstrapped] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [manualText, setManualText] = useState("")
  const [manualUnitId, setManualUnitId] = useState("")
  const [costSourceFilter, setCostSourceFilter] = useState<CostSourceFilter>("all")
  const [sellSubView, setSellSubView] = useState<QuoteClientSubView>("summary")
  const [expandedBidLineId, setExpandedBidLineId] = useState<string | null>(null)
  const [excelMode, setExcelMode] = useState(false)
  const [sheetDensity, setSheetDensity] = useState<SheetDensity>("compact")

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("ea-quote-excel-mode")
      if (stored === "1") setExcelMode(true)
      const density = sessionStorage.getItem("ea-quote-sheet-density")
      if (density === "normal") setSheetDensity("normal")
    } catch {
      /* ignore */
    }
  }, [])

  const toggleExcelMode = (next: boolean) => {
    setExcelMode(next)
    try {
      sessionStorage.setItem("ea-quote-excel-mode", next ? "1" : "0")
    } catch {
      /* ignore */
    }
  }

  const toggleSheetDensity = (next: SheetDensity) => {
    setSheetDensity(next)
    try {
      sessionStorage.setItem("ea-quote-sheet-density", next)
    } catch {
      /* ignore */
    }
  }

  const refresh = () => setTick((t) => t + 1)

  useEffect(() => {
    if (!editorReady) return
    void ensureCostItemsLoaded().then(() => {
      setCostItemsReady(true)
      refresh()
    })
  }, [editorReady])

  const ready = editorReady && costItemsReady

  const project = useMemo(() => (ready ? getProject(projectId) : undefined), [projectId, tick, ready])
  const quote = useMemo(() => (ready ? getQuote(quoteId) : undefined), [quoteId, tick, ready])
  const contract = useMemo(
    () => (quote ? getQuoteContractContext(quote.projectId, quote.id) : null),
    [quote, tick]
  )

  const executionMode = useMemo(
    () => isQuoteInExecutionMode(quote, project),
    [quote, project]
  )
  const contractPriceLocked = quote?.status === "accepted" && contract?.isContracted === true
  const priceSide: QuotePriceSide =
    editorTab === "execution" ? "cost" : editorTab

  useEffect(() => {
    if (!ready || !project || !quote || tabBootstrapped) return
    if (isQuoteInExecutionMode(quote, project)) {
      setEditorTab("execution")
    }
    setTabBootstrapped(true)
  }, [ready, project, quote, tabBootstrapped])
  const allLines = useMemo(() => (ready ? listQuoteLines(quoteId) : []), [quoteId, tick, ready])

  const quoteTrade = useMemo((): Trade => {
    if (!quote) return "epitomester"
    return quote.primaryTrade ?? inferPrimaryTrade(quote, allLines) ?? "epitomester"
  }, [quote, allLines])

  const lines = useMemo(
    () => allLines.filter((l) => l.trade === quoteTrade),
    [allLines, quoteTrade]
  )
  const costTotals = useMemo(() => quoteCostTotals(lines), [lines])
  const sellTotals = useMemo(
    () => (quote ? quoteSellTotals(lines, quote) : { material: 0, labor: 0, total: 0 }),
    [lines, quote]
  )
  const unpricedCount = useMemo(() => countUnpricedLines(lines), [lines])

  const catalogItems = useMemo(() => {
    const pool = loadCostItems().filter((i) => i.status === "active" && i.trade === quoteTrade)
    if (!search.trim()) return pool.slice(0, 30)
    return pool.filter((i) => matchesFuzzySearch(i, search)).slice(0, 30)
  }, [search, addOpen, tick, quoteTrade])

  const activeLines = useMemo(
    () => [...lines].sort((a, b) => a.sortOrder - b.sortOrder),
    [lines]
  )

  const activeLineKindCounts = useMemo(
    () => countLinesByVisualKind(activeLines),
    [activeLines]
  )

  const costFilterOptions = useMemo(
    () =>
      [
        ["all", `Mind (${activeLines.length})`],
        ["subcontractor", `Alváll. (${activeLineKindCounts.subcontractor})`],
        [
          "estimated",
          `Becsült (${activeLineKindCounts.catalog + activeLineKindCounts.manual})`,
        ],
        ["rfq_pending", `Vár (${activeLineKindCounts.rfq_pending})`],
        ["unpriced", `Árazatlan (${activeLineKindCounts.unpriced})`],
      ] as const,
    [activeLines.length, activeLineKindCounts]
  )

  const isSpreadsheetLayout =
    editorTab === "cost" ||
    editorTab === "markup" ||
    editorTab === "sell" ||
    editorTab === "execution"

  const clientBreakdown = useMemo(
    () => (quote ? buildQuoteTradeBreakdown(quote, lines) : null),
    [quote, lines]
  )
  const clientVatMode = quote ? resolveQuoteVatMode(quote) : "standard"
  const clientVatTotals = useMemo(
    () =>
      clientBreakdown
        ? calcQuoteVatTotals(clientBreakdown.totals.sellNetTotal, clientVatMode)
        : null,
    [clientBreakdown, clientVatMode]
  )
  const clientReadiness = useMemo(
    () =>
      clientBreakdown
        ? buildClientQuoteReadiness(
            clientBreakdown.totals.lineCount,
            clientBreakdown.totals.unpricedCount,
            unpricedCount > 0,
            clientBreakdown.totals.marginPercent
          )
        : null,
    [clientBreakdown, unpricedCount]
  )

  const activeMarkupTotals = useMemo(() => {
    const cost = quoteCostTotals(activeLines)
    const sell = quote ? quoteSellTotals(activeLines, quote) : { total: 0 }
    const margin = sell.total - cost.total
    return {
      costTotal: cost.total,
      sellTotal: sell.total,
      marginTotal: margin,
      marginPercent: cost.total > 0 ? Math.round((margin / cost.total) * 100) : null,
    }
  }, [activeLines, quote])

  const displayLines = useMemo(() => {
    if (editorTab !== "cost" || costSourceFilter === "all") return activeLines
    return activeLines.filter((l) => matchesCostSourceFilter(l, costSourceFilter))
  }, [activeLines, costSourceFilter, editorTab])

  const executionStats = useMemo(() => computeQuoteExecutionStats(activeLines), [activeLines])

  const executionFinancials = useMemo(() => {
    const contracted = buildContractedSellMap(projectId, quoteId)
    return computeExecutionFinancialTotals(activeLines, quote!, contracted)
  }, [activeLines, quote, projectId, quoteId])

  const marginTotal = sellTotals.total - costTotals.total
  const marginPercent =
    costTotals.total > 0 ? Math.round((marginTotal / costTotals.total) * 100) : null
  const isPartialTotal = unpricedCount > 0

  const existingCostItemIds = useMemo(
    () => new Set(lines.map((l) => l.costItemId).filter(Boolean) as string[]),
    [lines]
  )

  const catalogFillableCount = useMemo(() => {
    return lines.filter((l) => {
      if (!l.costItemId) return false
      return l.costMaterialUnitPrice === 0 && l.costLaborUnitPrice === 0
    }).length
  }, [lines])

  const statusChip = useMemo(
    () =>
      buildQuoteEditorStatusChip({
        editorTab,
        executionStats,
        lineCount: lines.length,
        pricedCount: lines.length - unpricedCount,
        unpricedCount,
        clientCanSend: clientReadiness?.canSend,
        marginPercent: clientBreakdown?.totals.marginPercent ?? marginPercent,
      }),
    [
      editorTab,
      executionStats,
      lines.length,
      unpricedCount,
      clientReadiness?.canSend,
      clientBreakdown?.totals.marginPercent,
      marginPercent,
    ]
  )

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-slate-500">Árajánlat betöltése…</p>
      </div>
    )
  }

  if (!project || !quote) {
    return <p className="text-slate-500">Az árajánlat nem található.</p>
  }

  const isReadOnly = quote.status === "archived"

  const handleAddLine = (item: CostItem) => {
    try {
      addQuoteLineFromCostItem(quoteId, item)
      refresh()
      toast.success("Tétel hozzáadva (ár nélkül)")
      setAddOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nem sikerült hozzáadni")
    }
  }

  const handleAddManualLine = () => {
    try {
      addManualQuoteLine(quoteId, {
        text: manualText,
        unitId: manualUnitId || loadUnits()[0]?.id || "",
      })
      refresh()
      toast.success("Szabad tétel hozzáadva (ár nélkül)")
      setManualText("")
      setAddOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nem sikerült hozzáadni")
    }
  }

  const handleFillFromCatalog = (lineId: string, costItemId: string) => {
    const item = loadCostItems().find((c) => c.id === costItemId)
    if (!item) return
    applyCatalogPricesToLine(lineId, item.materialUnitPrice, item.laborUnitPrice)
    refresh()
    toast.success("Becsült ár az ártükörből")
  }

  const handleCostPriceChange = (
    line: (typeof lines)[0],
    field: "costMaterialUnitPrice" | "costLaborUnitPrice",
    nextValue: number
  ) => {
    const prevValue = field === "costMaterialUnitPrice" ? line.costMaterialUnitPrice : line.costLaborUnitPrice
    if (
      line.costSource === "subcontractor" &&
      prevValue > 0 &&
      nextValue === 0 &&
      !confirm("Alvállalkozói ár törlése — visszaáll becslésre vagy árazatlanra. Folytatod?")
    ) {
      return
    }
    updateQuoteLine(line.id, { [field]: nextValue })
    refresh()
  }

  const handleBulkCatalogFill = () => {
    const n = applyCatalogToUnpricedLines(quoteId, quoteTrade)
    refresh()
    if (n > 0) {
      toast.success(`${n} tétel kitöltve az ártükörből`)
    } else {
      toast.info("Nincs kitölthető árazatlan tétel az ártükörben")
    }
  }

  const handleVatChange = (value: QuoteVatMode) => {
    if (!quote) return
    updateQuote(quote.id, { vatMode: value })
    refresh()
  }

  const vatSelect = (
    <Select
      value={clientVatMode}
      onValueChange={(v) => handleVatChange(v as QuoteVatMode)}
      disabled={isReadOnly || contractPriceLocked}
    >
      <SelectTrigger className="h-7 w-[9.5rem] shrink-0 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {QUOTE_VAT_OPTIONS.map((opt) => (
          <SelectItem key={opt.id} value={opt.id} className="text-xs">
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  const commandBarTools =
    priceSide === "cost" ? (
      <>
        <Button size="sm" className="h-7 shrink-0 px-2 text-xs" onClick={() => setAddOpen(true)} disabled={isReadOnly}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Tétel
        </Button>
        {catalogFillableCount > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 w-7 shrink-0 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[10rem] p-1">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-slate-100"
                onClick={handleBulkCatalogFill}
              >
                <BookOpen className="h-4 w-4" />
                Kitöltés ({catalogFillableCount})
              </button>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        <Button asChild variant="outline" size="sm" className="h-7 shrink-0 px-2 text-xs">
          <Link href={`/projektek/${projectId}?tab=rfq&quote=${quoteId}&openRfq=1`}>
            <Send className="mr-1 h-3 w-3" />
            Bekérés
          </Link>
        </Button>
      </>
    ) : priceSide === "sell" ? (
      vatSelect
    ) : null

  const commandBarTotals =
    editorTab === "execution" ? (
      <span className="inline-flex flex-wrap items-center justify-end gap-x-1.5 gap-y-0.5">
        <span>
          <span className="text-slate-600">Kész </span>
          <span className="font-bold text-emerald-900">
            {executionStats.done}/{executionStats.total}
          </span>
        </span>
        <span className="text-slate-300">·</span>
        <span>
          <span className="text-slate-600">Fedezet </span>
          <span className="font-bold text-emerald-900">
            {formatHuf(executionFinancials.margin)}
          </span>
          {executionFinancials.marginPercent != null ? (
            <span className="text-slate-500"> ({executionFinancials.marginPercent}%)</span>
          ) : null}
        </span>
      </span>
    ) : priceSide === "cost" ? (
      <>
        <span className="text-slate-600">Bekerülés </span>
        <span className="text-sm font-bold text-slate-900">{formatHuf(costTotals.total)}</span>
      </>
    ) : priceSide === "markup" ? (
      <>
        <span className="text-slate-600">Ügyfél </span>
        <span className="text-sm font-bold text-blue-900">
          {formatHuf(activeMarkupTotals.sellTotal)}
        </span>
      </>
    ) : clientVatTotals ? (
      <>
        <span className="text-slate-600">Bruttó </span>
        <span className="text-sm font-bold text-blue-900">
          {formatHuf(clientVatTotals.grossTotal)}
        </span>
      </>
    ) : (
      <span className="text-slate-400">—</span>
    )

  const sellSubNavToggle = (
    <div className="flex shrink-0 rounded-md border p-0.5">
      <Button
        type="button"
        size="sm"
        variant={sellSubView === "summary" ? "secondary" : "ghost"}
        className="h-7 px-2 text-xs"
        onClick={() => setSellSubView("summary")}
      >
        Összesítő
      </Button>
      <Button
        type="button"
        size="sm"
        variant={sellSubView === "lines" ? "secondary" : "ghost"}
        className="h-7 px-2 text-xs"
        onClick={() => setSellSubView("lines")}
      >
        Tételek
      </Button>
    </div>
  )

const footerSummaryLabel =
    editorTab === "cost" && costSourceFilter !== "all"
      ? `Szűrt összeg (${displayLines.length} tétel)`
      : "Összesen"

  const renderCostFilterChips = () => (
    <div className="flex flex-wrap gap-1">
      {costFilterOptions.map(([id, label]) => {
        const dotKind = costSourceFilterDotKind(id)
        return (
          <Button
            key={id}
            type="button"
            size="sm"
            variant={costSourceFilter === id ? "default" : "outline"}
            className="h-6 gap-1 px-2 text-[11px] font-normal"
            onClick={() => setCostSourceFilter(id)}
          >
            {id !== "all" ? (
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  costSourceKindDotClass(dotKind === "all" ? "catalog" : dotKind)
                )}
              />
            ) : null}
            {label}
          </Button>
        )
      })}
    </div>
  )

  const commandBarSubNav =
    editorTab === "sell" ? (
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
        {sellSubNavToggle}
      </div>
    ) : null

  const commandBarSubNavExtra = editorTab === "cost" ? renderCostFilterChips() : undefined

  const phaseNavItem = findNavItemByHref(listHrefForProject(project))
  const accentStyle = {
    "--page-accent": phaseNavItem?.accent ?? "var(--brand)",
    "--page-accent-muted": phaseNavItem?.accentMuted ?? "var(--brand-muted)",
  } as CSSProperties

  return (
    <div
      style={accentStyle}
      className={cn("flex min-h-0 flex-col", isSpreadsheetLayout && "h-[calc(100dvh)]")}
    >
      <QuoteEditorCommandBar
        projectId={projectId}
        projectName={project.name}
        quoteTitle={quote.title}
        tradeLabel={getTradeLabel(quoteTrade)}
        quoteStatus={quote.status}
        editorTab={editorTab}
        onEditorTabChange={setEditorTab}
        executionMode={executionMode}
        contractPriceLocked={contractPriceLocked}
        statusChip={statusChip}
        tools={commandBarTools}
        totals={commandBarTotals}
        subNav={commandBarSubNav}
        subNavExtra={commandBarSubNavExtra}
        excelMode={excelMode}
        onExcelModeChange={toggleExcelMode}
        showExcelModeToggle={editorTab === "cost" || editorTab === "markup"}
        sheetDensity={sheetDensity}
        onSheetDensityChange={toggleSheetDensity}
        showSheetDensityToggle={editorTab === "cost" || editorTab === "markup"}
      />

      {editorTab === "execution" ? (
        <QuoteExecutionPanel
          projectId={projectId}
          quoteId={quoteId}
          quote={quote}
          quoteTrade={quoteTrade}
          lines={lines}
          onRefresh={refresh}
        />
      ) : (
        <>
          {editorTab === "cost" && !excelMode ? (
            <div className="shrink-0 pt-0.5">
              <QuoteRfqPanel quote={quote} quoteId={quoteId} lines={lines} onRefresh={refresh} />
            </div>
          ) : null}

          {editorTab === "markup" ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <QuoteMarkupPanel
                quoteId={quoteId}
                quote={quote}
                lines={lines}
                displayLines={activeLines}
                quoteTrade={quoteTrade}
                readOnly={contractPriceLocked}
                excelMode={excelMode}
                sheetDensity={sheetDensity}
                onRefresh={refresh}
              />
            </div>
          ) : null}

          {editorTab === "sell" && quote && project ? (
            <>
              {contractPriceLocked ? (
                <div className="shrink-0 border-b border-blue-200 bg-blue-50/80 px-3 py-2 text-xs text-blue-950 sm:px-4">
                  Szerződött ügyfélár — csak megtekintés. A készültség és élő fedezet a{" "}
                  <strong>Kivitelezés</strong> fülön van.
                </div>
              ) : null}
              <QuoteClientPanel
                quote={quote}
                lines={lines}
                displayLines={activeLines}
                subView={sellSubView}
              />
            </>
          ) : null}

          {editorTab === "cost" ? (
            <div className={cn("min-h-0", isSpreadsheetLayout && "flex min-h-0 flex-1 flex-col")}>
              <QuoteCostSpreadsheet
                quoteId={quoteId}
                quote={quote}
                lines={lines}
                displayLines={displayLines}
                costItems={loadCostItems()}
                isReadOnly={isReadOnly}
                excelMode={excelMode}
                sheetDensity={sheetDensity}
                footerLabel={footerSummaryLabel}
                costSourceFilterActive={costSourceFilter !== "all"}
                onClearFilter={() => setCostSourceFilter("all")}
                onRefresh={refresh}
                onFillFromCatalog={handleFillFromCatalog}
                onCostPriceChange={handleCostPriceChange}
                expandedBidLineId={expandedBidLineId}
                onExpandedBidLineIdChange={setExpandedBidLineId}
              />
            </div>
          ) : null}
        </>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[80vh] sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              Tétel hozzáadása (ár nélkül) — {getTradeLabel(quoteTrade)}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-700">
            A tétel szövege és mennyisége bemásolódik. Az árat később adod meg, vagy alvállalkozótól
            kéred.
          </p>
          <Input
            placeholder="Keresés…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <ul className="max-h-80 space-y-1 overflow-y-auto">
            {catalogItems.map((item) => {
              const duplicate = existingCostItemIds.has(item.id)
              return (
              <li key={item.id}>
                <button
                  type="button"
                  className={cn(
                    "w-full rounded-md border px-3 py-2 text-left text-sm hover:bg-blue-50",
                    duplicate ? "border-amber-200 bg-amber-50/50" : ""
                  )}
                  onClick={() => handleAddLine(item)}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-code text-sm text-blue-700">{item.identifier}</span>
                    {duplicate ? (
                      <Badge variant="warning">
                        már a listában
                      </Badge>
                    ) : null}
                  </div>
                  <p className="whitespace-normal break-words text-slate-800">{item.text}</p>
                </button>
              </li>
            )})}
            {catalogItems.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-500">Nincs találat.</p>
            ) : null}
          </ul>
          <div className="rounded-md border border-dashed border-slate-300 bg-slate-50/60 p-3">
            <p className="mb-2 text-xs font-semibold text-slate-700">
              Szabad tétel — nincs az ártükörben
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Tétel leírása…"
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                className="min-w-[12rem] flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && manualText.trim()) handleAddManualLine()
                }}
              />
              <Select value={manualUnitId} onValueChange={setManualUnitId}>
                <SelectTrigger className="w-24">
                  <SelectValue placeholder="Egység" />
                </SelectTrigger>
                <SelectContent>
                  {loadUnits().map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="sm"
                disabled={!manualText.trim()}
                onClick={handleAddManualLine}
              >
                Hozzáadás
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
