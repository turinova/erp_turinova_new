import type { QuoteStatus } from "@/types/projects"
import {
  getProject,
  listInvitationsForProject,
  listCustomerPackagesForProject,
  listQuoteLines,
  listQuotesForProject,
  listRfqsForProject,
  listSubmissionsForProject,
} from "@/lib/data/projects-store"
import {
  buildProjectAggregatedTotals,
  buildProjectAllQuotesTotals,
  buildProjectTradeOverviewRows,
  buildQuoteWithSummary,
} from "@/lib/project-quote-aggregation"
import { buildContractBaseline } from "@/lib/contract-baseline"
import { getActiveSentPackage } from "@/lib/customer-package"
import { computeQuoteExecutionStats } from "@/lib/quote-execution"
import {
  buildQuoteTodo,
  quoteDisplayMarginPercent,
  type QuoteTodo,
  type QuoteTodoAction,
} from "@/lib/quote-list-helpers"
import {
  buildTradeRfqSummary,
  type RfqTodo,
  type RfqTodoAction,
} from "@/lib/trade-rfq-summary"

export type OverviewHeroTone = "success" | "warning" | "error" | "info" | "neutral"

export type OverviewHeroAction = {
  title: string
  detail: string
  tone: OverviewHeroTone
  actionLabel: string
  action:
    | "create_quote"
    | "navigate_quotes"
    | "navigate_rfq"
    | "open_editor"
    | "send_package"
    | "record_client_response"
    | "none"
  quoteId?: string
  packageId?: string
}

export type TradeDashboardAction =
  | "open_editor"
  | "navigate_rfq"
  | "start_rfq"
  | "apply_prices"
  | "send_to_client"
  | "none"

export type TradeDashboardRow = {
  quoteId: string
  tradeLabel: string
  quoteTitle: string
  status: QuoteStatus
  grossTotal: number
  costNet: number
  marginNet: number
  marginPercent: number | null
  unpricedCount: number
  lineCount: number
  pricedCount: number
  pricedPercent: number
  isPartialTotal: boolean
  rfqCount: number
  canExportPdf: boolean
  todoLabel: string
  todoDetail?: string
  todoTone: "success" | "warning" | "neutral"
  actionable: boolean
  actionLabel: string
  action: TradeDashboardAction
  executionDone?: number
  executionTotal?: number
  executionPercent?: number
}

function quoteActionPriority(action: QuoteTodoAction): number {
  switch (action) {
    case "pick_subcontractor":
      return 95
    case "open_editor":
      return 85
    case "send_rfq":
      return 75
    case "view_subcontractors":
      return 55
    case "send_to_client":
      return 45
    default:
      return 0
  }
}

function rfqActionPriority(action: RfqTodoAction): number {
  switch (action) {
    case "decide":
      return 100
    case "start":
      return 70
    case "view":
      return 60
    case "wait":
      return 50
    default:
      return 0
  }
}

function mapQuoteAction(action: QuoteTodoAction): TradeDashboardAction {
  switch (action) {
    case "open_editor":
      return "open_editor"
    case "pick_subcontractor":
    case "view_subcontractors":
      return "navigate_rfq"
    case "send_rfq":
      return "start_rfq"
    case "send_to_client":
      return "send_to_client"
    default:
      return "none"
  }
}

function mapRfqAction(action: RfqTodoAction): TradeDashboardAction {
  switch (action) {
    case "decide":
    case "view":
    case "wait":
      return "navigate_rfq"
    case "start":
      return "start_rfq"
    default:
      return "none"
  }
}

function mapActionLabel(action: TradeDashboardAction): string {
  switch (action) {
    case "open_editor":
      return "Megnyitás"
    case "navigate_rfq":
      return "Alvállalkozók"
    case "start_rfq":
      return "Bekérés"
    case "apply_prices":
      return "Beírás"
    case "send_to_client":
      return "Ügyfélnek"
    default:
      return "—"
  }
}

function mergeNextStep(
  _quote: unknown,
  quoteTodo: QuoteTodo,
  rfqTodo: RfqTodo,
  summary: { unappliedSubmissionCount: number }
): {
  label: string
  detail?: string
  tone: "success" | "warning" | "neutral"
  actionable: boolean
  action: TradeDashboardAction
} {
  if (summary.unappliedSubmissionCount > 0) {
    const n = summary.unappliedSubmissionCount
    return {
      label: "Írd be a nyertes árakat",
      detail:
        n === 1
          ? "A döntés megszületett — 1 tétel ára még nincs a költségvetésben"
          : `A döntés megszületett — ${n} tétel ára még nincs a költségvetésben`,
      tone: "warning",
      actionable: true,
      action: "apply_prices",
    }
  }

  const qPri = quoteActionPriority(quoteTodo.action)
  const rPri = rfqActionPriority(rfqTodo.action)

  if (rPri > qPri && rfqTodo.actionable) {
    return {
      label: rfqTodo.label,
      detail: rfqTodo.detail,
      tone: rfqTodo.tone === "success" ? "success" : rfqTodo.tone === "warning" ? "warning" : "neutral",
      actionable: rfqTodo.actionable,
      action: mapRfqAction(rfqTodo.action),
    }
  }

  if (quoteTodo.actionable) {
    return {
      label: quoteTodo.label,
      detail: quoteTodo.detail,
      tone:
        quoteTodo.tone === "success"
          ? "success"
          : quoteTodo.tone === "warning"
            ? "warning"
            : "neutral",
      actionable: true,
      action: mapQuoteAction(quoteTodo.action),
    }
  }

  if (rfqTodo.actionable) {
    return {
      label: rfqTodo.label,
      detail: rfqTodo.detail,
      tone: rfqTodo.tone === "success" ? "success" : rfqTodo.tone === "warning" ? "warning" : "neutral",
      actionable: true,
      action: mapRfqAction(rfqTodo.action),
    }
  }

  return {
    label: quoteTodo.label,
    detail: quoteTodo.detail,
    tone: quoteTodo.tone === "success" ? "success" : "neutral",
    actionable: false,
    action: "none",
  }
}

export function buildTradeDashboardRows(projectId: string): TradeDashboardRow[] {
  const project = getProject(projectId)
  const isExecution =
    project != null &&
    (project.status === "won" ||
      project.status === "in_progress" ||
      project.status === "done")
  const tradeRows = buildProjectTradeOverviewRows(projectId)
  const packages = listRfqsForProject(projectId)
  const allInvitations = listInvitationsForProject(projectId)
  const allSubmissions = listSubmissionsForProject(projectId)

  return tradeRows.map((row) => {
    const lines = listQuoteLines(row.quote.id)
    const quotePackages = packages.filter((p) => p.quoteId === row.quote.id)
    const quoteInvitations = allInvitations.filter((i) =>
      quotePackages.some((p) => p.id === i.packageId)
    )
    const quoteSubmissions = allSubmissions.filter((s) =>
      quotePackages.some((p) => p.id === s.rfqId)
    )

    const rfqSummary = buildTradeRfqSummary(
      row.quote,
      lines,
      packages,
      quoteInvitations,
      quoteSubmissions
    )
    const quoteTodo = buildQuoteTodo(row.quote, row.summary)
    const next = mergeNextStep(row.quote, quoteTodo, rfqSummary.todo, row.summary)

    const action =
      next.action === "none" && next.actionable ? "open_editor" : next.action
    const actionLabel =
      next.action === "none" && !next.actionable
        ? "Kész"
        : next.action !== "none"
          ? mapActionLabel(next.action)
          : "Megnyitás"

    const executionStats =
      isExecution && row.status === "accepted"
        ? computeQuoteExecutionStats(lines)
        : null

    return {
      quoteId: row.quote.id,
      tradeLabel: row.label,
      quoteTitle: row.quote.title,
      status: row.status,
      grossTotal: row.grossTotal,
      costNet: row.summary.costTotal,
      marginNet: row.summary.marginTotal,
      marginPercent: quoteDisplayMarginPercent(row.summary),
      unpricedCount: row.summary.unpricedCount,
      lineCount: row.summary.lineCount,
      pricedCount: row.summary.pricedCount,
      pricedPercent: row.pricedPercent,
      isPartialTotal: row.summary.isPartialTotal,
      rfqCount: row.summary.rfqCount,
      canExportPdf: row.summary.readiness.canExportPdf,
      todoLabel: next.label,
      todoDetail: next.detail,
      todoTone: next.tone,
      actionable: next.actionable,
      actionLabel,
      action,
      executionDone: executionStats?.done,
      executionTotal: executionStats?.total,
      executionPercent: executionStats?.percent,
    }
  })
}

const HERO_TONE_PRIORITY: Record<OverviewHeroTone, number> = {
  error: 100,
  warning: 80,
  info: 60,
  neutral: 40,
  success: 20,
}

function heroFromRow(row: TradeDashboardRow): OverviewHeroAction | null {
  if (!row.actionable) return null
  const tone: OverviewHeroTone = row.todoTone === "warning" ? "warning" : "info"
  return {
    title: `${row.tradeLabel}: ${row.todoLabel}`,
    detail: row.todoDetail ?? row.quoteTitle,
    tone,
    actionLabel: row.actionLabel,
    action:
      row.action === "open_editor" || row.action === "send_to_client"
        ? "open_editor"
        : row.action === "start_rfq" || row.action === "navigate_rfq" || row.action === "apply_prices"
          ? row.action === "start_rfq"
            ? "navigate_rfq"
            : row.action === "apply_prices"
              ? "navigate_quotes"
              : "navigate_rfq"
          : "none",
    quoteId: row.quoteId,
  }
}

export function buildProjectHeroAction(projectId: string): OverviewHeroAction {
  const quotes = listQuotesForProject(projectId).filter((q) => q.status !== "archived")
  if (quotes.length === 0) {
    return {
      title: "Kezdd az első költségvetéssel",
      detail: "Vedd fel szakágonként a tételeket és árakat — innen látod majd az egész projektet.",
      tone: "warning",
      actionLabel: "Szakág hozzáadása",
      action: "create_quote",
    }
  }

  const projectTotals = buildProjectAggregatedTotals(projectId)
  const packages = listRfqsForProject(projectId)
  const now = Date.now()

  const expiredCount = packages.filter(
    (p) => p.status === "open" && new Date(p.expiresAt).getTime() < now
  ).length

  if (expiredCount > 0) {
    return {
      title:
        expiredCount === 1
          ? "1 bekérés lejárt — új kör kell"
          : `${expiredCount} bekérés lejárt — új kör kell`,
      detail: "Az alvállalkozók nem tudták benyújtani időben. Indíts új bekérést vagy hosszabbítsd a határidőt.",
      tone: "error",
      actionLabel: "Alvállalkozók megnyitása",
      action: "navigate_rfq",
    }
  }

  const rows = buildTradeDashboardRows(projectId)
  const candidates = rows.map(heroFromRow).filter((h): h is OverviewHeroAction => h != null)

  if (candidates.length > 0) {
    candidates.sort((a, b) => HERO_TONE_PRIORITY[b.tone] - HERO_TONE_PRIORITY[a.tone])
    return candidates[0]
  }

  const customerPackages = listCustomerPackagesForProject(projectId)
  const activeSent = getActiveSentPackage(customerPackages)
  if (activeSent) {
    return {
      title: "Várakozás az ügyfél válaszára",
      detail: `${activeSent.snapshots.length} szakág · ${new Date(activeSent.sentAt).toLocaleDateString("hu-HU")} — rögzítsd a választ, ha megérkezett.`,
      tone: "info",
      actionLabel: "Válasz rögzítése",
      action: "record_client_response",
      packageId: activeSent.id,
    }
  }

  if (projectTotals.canSend) {
    return {
      title: "A projekt kész — küldheted az ügyfélnek",
      detail: "Minden szakág árazva, a bruttó összeg meghatározható.",
      tone: "success",
      actionLabel: "Küldés megrendelőnek",
      action: "send_package",
    }
  }

  if (projectTotals.draftQuoteCount > 0 && projectTotals.selected.length === 0) {
    return {
      title: "Állítsd „Elküldve” státuszra a szakágokat",
      detail: "A bruttó projektösszeg csak elküldött vagy elfogadott ajánlatokból számít.",
      tone: "info",
      actionLabel: "Költségvetés",
      action: "navigate_quotes",
    }
  }

  return {
    title: "Minden szakág rendben",
    detail: "Nincs sürgős teendő — nézd át a részleteket alább.",
    tone: "success",
    actionLabel: "Költségvetés",
    action: "navigate_quotes",
  }
}

export function buildOverviewKpis(projectId: string) {
  const project = getProject(projectId)
  const isExecution =
    project != null &&
    (project.status === "won" ||
      project.status === "in_progress" ||
      project.status === "done")

  if (isExecution) {
    const contract = buildContractBaseline(projectId)
    const acceptedRows = listQuotesForProject(projectId)
      .filter((q) => q.status === "accepted")
      .map(buildQuoteWithSummary)

    let liveCostNet = 0
    let liveMarginNet = 0
    let lineCount = 0
    let pricedCount = 0
    for (const row of acceptedRows) {
      liveCostNet += row.summary.costTotal
      liveMarginNet += row.summary.marginTotal
      lineCount += row.summary.lineCount
      pricedCount += row.summary.pricedCount
    }

    const liveMarginOnContract =
      contract.sellNetTotal > 0
        ? contract.sellNetTotal - liveCostNet
        : liveMarginNet

    const marginPercentOnContract =
      contract.sellNetTotal > 0
        ? Math.round((liveMarginOnContract / contract.sellNetTotal) * 100)
        : null

    const draftQuoteCount = listQuotesForProject(projectId).filter(
      (q) => q.status === "draft"
    ).length

    let executionDone = 0
    let executionTotal = 0
    for (const row of acceptedRows) {
      const stats = computeQuoteExecutionStats(listQuoteLines(row.quote.id))
      executionDone += stats.done
      executionTotal += stats.total
    }
    const executionPercent =
      executionTotal > 0 ? Math.round((executionDone / executionTotal) * 100) : 0

    return {
      mode: "execution" as const,
      contractGross: contract.grossTotal,
      contractSellNet: contract.sellNetTotal,
      baseGross: contract.baseGrossTotal,
      supplementGross: contract.supplementGrossTotal,
      liveCostNet,
      liveMarginNet: liveMarginOnContract,
      marginPercentOnContract,
      lineCount,
      pricedPercent: lineCount > 0 ? Math.round((pricedCount / lineCount) * 100) : 0,
      draftQuoteCount,
      contractTradeCount: contract.tradeRows.length,
      hasContract: contract.hasContract,
      hasData: contract.hasContract || acceptedRows.length > 0,
      executionDone,
      executionTotal,
      executionPercent,
    }
  }

  const totals = buildProjectAllQuotesTotals(projectId)
  const sellNet = totals.sellNetTotal
  const sellGross = totals.grossTotal
  const costNet = totals.costTotal
  const marginTotal = totals.marginTotal
  const vatAmount = sellGross - sellNet
  const marginPercentOnCost = totals.marginPercent
  const marginPercentOnSell =
    sellNet > 0 && totals.lineCount > 0
      ? Math.round((marginTotal / sellNet) * 100)
      : null

  return {
    mode: "quoting" as const,
    costNet,
    sellNet,
    sellGross,
    vatAmount,
    marginTotal,
    marginPercentOnCost,
    marginPercentOnSell,
    pricedPercent: totals.pricedPercent,
    lineCount: totals.lineCount,
    isPartial: totals.isPartialTotal,
    canSend: totals.canSend,
    vatChip: totals.vatChipLabel,
    mixedVat: totals.mixedVat,
    modeLabel: totals.modeLabel,
    draftQuoteCount: totals.draftQuoteCount,
    hasData: totals.lineCount > 0 || totals.selected.length > 0,
  }
}
