"use client"

import dynamic from "next/dynamic"
import { useEffect, useMemo, useState, Fragment, type CSSProperties } from "react"
import Link from "next/link"
import {
  BookOpen,
  Hand,
  MoreHorizontal,
  Plus,
  Send,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import type { QuotePriceSide, QuoteVatMode } from "@/types/projects"
import type { CostItem, Trade } from "@/types"
import { isQuoteInExecutionMode, computeQuoteExecutionStats, computeExecutionFinancialTotals, buildContractedSellMap } from "@/lib/quote-execution"
import { QUOTE_EXCEL_COLUMNS } from "@/lib/quote-columns"
import { loadCostItems } from "@/lib/data/cost-items-store"
import {
  buildCostItemMap,
  buildLineSectionNumbers,
  getLineInternalIdentifier,
  getLineSectionNumber,
} from "@/lib/quote-line-display"
import {
  addManualQuoteLine,
  addQuoteLineFromCostItem,
  applyCatalogPricesToLine,
  applyCatalogToUnpricedLines,
  convertQuoteLineToManualCost,
  deleteQuoteLine,
  getProject,
  getQuote,
  getSubmission,
  listQuoteLines,
  updateQuote,
  updateQuoteLine,
} from "@/lib/data/projects-store"
import { matchesFuzzySearch } from "@/lib/cost-item-search"
import {
  countUnpricedLines,
  lineCostLaborTotal,
  lineCostMaterialTotal,
  lineCostTotal,
  quoteCostTotals,
  quoteSellTotals,
} from "@/lib/quote-utils"
import { inferPrimaryTrade } from "@/lib/project-quote-aggregation"
import { getQuoteContractContext } from "@/lib/quote-contract-context"
import { getQuoteLineRfqContexts } from "@/lib/quote-rfq-context"
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
  QuoteLineSourceIcon,
  countLinesByVisualKind,
  getQuoteLineRowClass,
  getQuoteLineVisualKind,
  matchesCostSourceFilter,
  subcontractorPriceInputClass,
  type CostSourceFilter,
} from "@/lib/quote-line-visual"
import {
  QuoteLineBidExpandRow,
  lineHasRfqBids,
} from "@/components/projektek/quote-line-bid-expand"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { QuoteEditorCommandBar, type QuoteEditorTab } from "@/components/projektek/quote-editor-command-bar"
import type { QuoteClientSubView } from "@/components/projektek/quote-client-panel"
import {
  buildQuoteEditorStatusChip,
} from "@/components/projektek/quote-editor-status-chip"
import { QuoteTableFooterSummary } from "@/components/projektek/quote-table-footer-summary"
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

const COL = QUOTE_EXCEL_COLUMNS

const numericInputNoSpinner =
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"

const priceInputClass = cn("min-w-[5.5rem] w-28 text-right text-xs", numericInputNoSpinner)

function PriceInput({
  value,
  onChange,
  className,
}: {
  value: number
  onChange: (v: number) => void
  className?: string
}) {
  const [draft, setDraft] = useState(() => (value > 0 ? String(value) : ""))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) {
      setDraft(value > 0 ? String(value) : "")
    }
  }, [value, focused])

  const commit = () => {
    const raw = draft.replace(/\s/g, "").replace(",", ".")
    const num = raw === "" ? 0 : Number(raw)
    if (!Number.isNaN(num) && num >= 0) {
      if (num !== value) onChange(num)
    } else {
      setDraft(value > 0 ? String(value) : "")
    }
    setFocused(false)
  }

  return (
    <Input
      type="text"
      inputMode="numeric"
      className={cn("h-7", priceInputClass, className)}
      value={draft}
      placeholder="0"
      onFocus={() => setFocused(true)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault()
          e.currentTarget.blur()
        }
        if (e.key === "Escape") {
          setDraft(value > 0 ? String(value) : "")
          e.currentTarget.blur()
        }
      }}
    />
  )
}

function QuantityInput({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  const [draft, setDraft] = useState(() => String(value))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setDraft(String(value))
  }, [value, focused])

  const commit = () => {
    const raw = draft.replace(/\s/g, "").replace(",", ".")
    const num = raw === "" ? 0 : Number(raw)
    if (!Number.isNaN(num) && num >= 0) {
      if (num !== value) onChange(num)
    } else {
      setDraft(String(value))
    }
    setFocused(false)
  }

  return (
    <Input
      type="text"
      inputMode="decimal"
      className={cn("h-7 w-16 text-xs", numericInputNoSpinner)}
      value={draft}
      onFocus={() => setFocused(true)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault()
          e.currentTarget.blur()
        }
        if (e.key === "Escape") {
          setDraft(String(value))
          e.currentTarget.blur()
        }
      }}
    />
  )
}

function UnitSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (unitId: string) => void
}) {
  const units = loadUnits()
  const resolved = unitMap[value] ? value : units[0]?.id ?? value

  return (
    <Select value={resolved} onValueChange={onChange}>
      <SelectTrigger className="h-7 w-[4.25rem] px-1.5 text-xs" title="Mértékegység">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {units.map((unit) => (
          <SelectItem key={unit.id} value={unit.id} className="text-xs">
            {unit.code}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
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

  const costItemById = useMemo(() => buildCostItemMap(loadCostItems()), [tick])
  const sectionNumbers = useMemo(() => buildLineSectionNumbers(allLines), [allLines])

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

  const displayCostTotals = useMemo(() => quoteCostTotals(displayLines), [displayLines])

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

  const handleDeleteLine = (lineId: string, label: string) => {
    if (!confirm(`„${label}” törlése az árajánlatból?`)) return
    deleteQuoteLine(lineId)
    refresh()
    toast.success("Tétel törölve")
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

  const handleConvertToManual = (line: (typeof lines)[0]) => {
    const lineLabel = getLineInternalIdentifier(line, costItemById)
    const msg =
      line.costSource === "subcontractor"
        ? `„${lineLabel}” — saját kivitelezésre váltasz? Az alvállalkozói forrás törlődik, az ár megmarad kézi bevitelként.`
        : `„${lineLabel}” — kivéve a bekérésből, kézi árazásra váltasz?`
    if (!confirm(msg)) return
    convertQuoteLineToManualCost(line.id)
    refresh()
    toast.success("Kézi árazásra váltva")
  }

  const COST_TABLE_COLS = 12

  const renderCostRow = (line: (typeof lines)[0], rowIndex: number) => {
    const visualKind = getQuoteLineVisualKind(line)
    const submission = line.costSourceRfqSubmissionId
      ? getSubmission(line.costSourceRfqSubmissionId)
      : undefined
    const priceClass = subcontractorPriceInputClass(line)

    const showBidExpand = lineHasRfqBids(line, quoteId, lines)
    const bidExpanded = expandedBidLineId === line.id

    const rfqBidCount = getQuoteLineRfqContexts(line.id, quoteId, lines).reduce(
      (max, c) => Math.max(max, c.submissionCount),
      0
    )

    return (
    <Fragment key={line.id}>
    <tr
      className={cn("border-b [&_td]:align-top", getQuoteLineRowClass(visualKind))}
    >
      <td className="px-2 py-1.5 font-code text-xs text-slate-600">
        {getLineSectionNumber(line.id, sectionNumbers, rowIndex + 1)}
      </td>
      <td className="px-2 py-1.5 font-code text-xs font-medium text-blue-700">
        {getLineInternalIdentifier(line, costItemById)}
      </td>
      <td className="min-w-[12rem] max-w-md px-2 py-1.5 text-xs">
        <span className="block whitespace-normal break-words leading-snug">{line.textSnapshot}</span>
      </td>
      <td className="px-2 py-1.5">
        <QuantityInput
          value={line.quantity}
          onChange={(v) => {
            updateQuoteLine(line.id, { quantity: v })
            refresh()
          }}
        />
      </td>
      <td className="px-2 py-1.5">
        <UnitSelect
          value={line.unitId}
          onChange={(unitId) => {
            updateQuoteLine(line.id, { unitId })
            refresh()
          }}
        />
      </td>
      <td className="px-2 py-1.5">
        <PriceInput
          value={line.costMaterialUnitPrice}
          className={priceClass}
          onChange={(v) => handleCostPriceChange(line, "costMaterialUnitPrice", v)}
        />
      </td>
      <td className="px-2 py-1.5">
        <PriceInput
          value={line.costLaborUnitPrice}
          className={priceClass}
          onChange={(v) => handleCostPriceChange(line, "costLaborUnitPrice", v)}
        />
      </td>
      <td className="px-2 py-1.5 text-right text-xs tabular-nums">
        {formatHuf(lineCostMaterialTotal(line))}
      </td>
      <td className="px-2 py-1.5 text-right text-xs tabular-nums">
        {formatHuf(lineCostLaborTotal(line))}
      </td>
      <td className="px-2 py-1.5 text-right text-xs font-medium tabular-nums">
        {formatHuf(lineCostTotal(line))}
      </td>
      <td className="w-14 px-2 py-1.5">
        {visualKind === "rfq_pending" && rfqBidCount > 0 ? (
          <span
            title="Beküldött alvállalkozói ajánlatok"
            className="text-xs font-medium text-blue-800"
          >
            {rfqBidCount} aj.
          </span>
        ) : (
          <QuoteLineSourceIcon line={line} submittedAt={submission?.submittedAt} />
        )}
      </td>
      <td className="px-1 py-1.5">
        <div className="flex items-center gap-0">
          {line.costItemId && line.pricingStatus === "unpriced" ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-slate-500"
              title="Becsült ár az ártükörből"
              onClick={() => handleFillFromCatalog(line.id, line.costItemId!)}
            >
              <BookOpen className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          {line.costSource === "subcontractor" || line.pricingStatus === "rfq_pending" ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-slate-500 hover:text-amber-800"
              title="Saját kivitelezés — kézi ár"
              onClick={() => handleConvertToManual(line)}
            >
              <Hand className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
            onClick={() =>
              handleDeleteLine(line.id, getLineInternalIdentifier(line, costItemById))
            }
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
    {showBidExpand ? (
      <QuoteLineBidExpandRow
        line={line}
        quoteId={quoteId}
        allLines={lines}
        expanded={bidExpanded}
        onToggle={() => setExpandedBidLineId(bidExpanded ? null : line.id)}
        colSpan={COST_TABLE_COLS}
      />
    ) : null}
    </Fragment>
    )
  }

  const costTableHead = (
    <thead className="ea-table-head sticky top-0 z-10 text-xs shadow-sm">
      <tr>
        <th className="px-2 py-1.5">{COL.ssz}</th>
        <th className="px-2 py-1.5">{COL.identifier}</th>
        <th className="px-2 py-1.5">{COL.text}</th>
        <th className="px-2 py-1.5">{COL.quantity}</th>
        <th className="px-2 py-1.5">{COL.unit}</th>
        <th className="px-2 py-1.5 text-right">{COL.materialUnit}</th>
        <th className="px-2 py-1.5 text-right">{COL.laborUnit}</th>
        <th className="px-2 py-1.5 text-right">{COL.materialTotal}</th>
        <th className="px-2 py-1.5 text-right">{COL.laborTotal}</th>
        <th className="px-2 py-1.5 text-right">Össz.</th>
        <th className="w-14 px-2 py-1.5" title="Forrás">
          Forr.
        </th>
        <th className="w-14 px-1 py-1.5" />
      </tr>
    </thead>
  )

  const renderTableFooter = () => {
    if (editorTab !== "cost" || displayLines.length === 0) return null
    return (
      <QuoteTableFooterSummary
        label={footerSummaryLabel}
        cells={[
          {
            label: COL.materialTotal,
            value: formatHuf(displayCostTotals.material),
            tone: "material",
          },
          {
            label: COL.laborTotal,
            value: formatHuf(displayCostTotals.labor),
            tone: "labor",
          },
          {
            label: "Összesen",
            value: formatHuf(displayCostTotals.total),
            tone: "cost",
            emphasis: true,
          },
        ]}
      />
    )
  }

  const renderScrollableTable = () => (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-white shadow-sm">
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[960px] text-sm">
          {costTableHead}
          <tbody>
            {displayLines.map((line, i) => renderCostRow(line, i))}
          </tbody>
        </table>
        {displayLines.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            {costSourceFilter !== "all" ? (
              <>
                <p>Nincs tétel ezen a szűrőn.</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => setCostSourceFilter("all")}
                >
                  Szűrő törlése
                </Button>
              </>
            ) : (
              <p>Adj hozzá tételeket az ártükörből.</p>
            )}
          </div>
        ) : null}
      </div>
      {renderTableFooter()}
    </div>
  )

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
          {editorTab === "cost" ? (
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
              {renderScrollableTable()}
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
