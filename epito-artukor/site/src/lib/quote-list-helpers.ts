import type { Quote, QuoteStatus } from "@/types/projects"
import { getTradeLabel } from "@/lib/trades"
import { QUOTE_SCOPE_LABELS } from "@/lib/project-labels"
import type { QuoteSummary } from "@/lib/quote-summary"
import { getMinAcceptableMarginPercent } from "@/lib/quote-summary"

export type QuoteTodoTone = "success" | "warning" | "neutral"

/** Hova navigáljon a kattintás — építésvezető konkrét következő lépése */
export type QuoteTodoAction =
  | "open_editor"
  | "pick_subcontractor"
  | "view_subcontractors"
  | "send_rfq"
  | "send_to_client"
  | "none"

export type QuoteTodo = {
  /** Mit csináljon az építésvezető — cselekvő igével */
  label: string
  detail?: string
  tone: QuoteTodoTone
  actionable: boolean
  action: QuoteTodoAction
}

/** Fedezet % az ügyfél árhoz viszonyítva — egységes a lábléccel */
export function quoteDisplayMarginPercent(summary: QuoteSummary): number | null {
  if (summary.lineCount === 0 || summary.sellTotal <= 0) return null
  return Math.round((summary.marginTotal / summary.sellTotal) * 100)
}

export function quoteTradeLabel(quote: Quote): string {
  const scope = quote.quoteScope ?? "trade"
  if (scope === "trade" && quote.primaryTrade) {
    return getTradeLabel(quote.primaryTrade)
  }
  return QUOTE_SCOPE_LABELS[scope]
}

function clientStatusTodo(status: QuoteStatus, canSend: boolean): QuoteTodo | null {
  if (status === "accepted") {
    return {
      label: "Szerződött — pipáld a kész tételeket",
      detail: "Kivitelezés fül: készültség · Bekerülés fül: költségkövetés",
      tone: "success",
      actionable: true,
      action: "open_editor",
    }
  }
  if (status === "rejected") {
    return {
      label: "Módosítsd az árakat",
      detail: "Az ügyfél elutasította — készíts új ajánlatot",
      tone: "warning",
      actionable: true,
      action: "open_editor",
    }
  }
  if (status === "sent") {
    return {
      label: "Várj az ügyfél válaszára",
      detail: "Az ajánlatot már elküldted",
      tone: "neutral",
      actionable: false,
      action: "none",
    }
  }
  if (status === "archived") {
    return {
      label: "Archivált szakág",
      detail: "Nem aktív költségvetés",
      tone: "neutral",
      actionable: false,
      action: "none",
    }
  }
  if (canSend && (status === "draft" || status === "sent")) {
    return {
      label: "Küldd el az ügyfélnek",
      detail: "Minden ár rendben — mehet az ajánlat",
      tone: "success",
      actionable: true,
      action: "send_to_client",
    }
  }
  return null
}

/**
 * Építésvezetőnek szóló következő lépés — imperatív, konkrét, zsargon nélkül.
 * Prioritás: hiányzó munka → döntés → várakozás → árazás → fedezet → ügyfélnek küldés.
 */
export function buildQuoteTodo(quote: Quote, summary: QuoteSummary): QuoteTodo {
  if (summary.lineCount === 0) {
    return {
      label: "Add hozzá a tételeket",
      detail: "Nyisd meg a szakágát, és vedd fel a költségvetési sorokat",
      tone: "warning",
      actionable: true,
      action: "open_editor",
    }
  }

  if (summary.unappliedSubmissionCount > 0) {
    const n = summary.unappliedSubmissionCount
    return {
      label: "Válaszd ki a nyertes alvállalkozót",
      detail:
        n === 1
          ? "1 beküldött ajánlat érkezett — döntsd el, melyik ár kerül be"
          : `${n} beküldött ajánlat érkezett — döntsd el, melyik ár kerül be`,
      tone: "warning",
      actionable: true,
      action: "pick_subcontractor",
    }
  }

  if (summary.unpricedNotRfqCount > 0) {
    const n = summary.unpricedNotRfqCount
    return {
      label: "Add meg az árakat",
      detail:
        n === 1
          ? "1 tételnél töltsd ki a bekerülési árat (kézzel vagy katalógusból)"
          : `${n} tételnél töltsd ki a bekerülési árat (kézzel vagy katalógusból)`,
      tone: "warning",
      actionable: true,
      action: "open_editor",
    }
  }

  if (summary.rfqPendingCount > 0) {
    if (summary.rfqAwaitingCount > 0 && summary.rfqSubmissionCount === 0) {
      return {
        label: "Várj az alvállalkozó válaszára",
        detail: `${summary.rfqAwaitingCount} cégnek kiment az árbekérés — még nem érkezett válasz`,
        tone: "neutral",
        actionable: true,
        action: "view_subcontractors",
      }
    }
    if (summary.rfqSubmissionCount > 0) {
      return {
        label: "Válaszd ki a nyertes alvállalkozót",
        detail: "Megérkezett ajánlat — döntsd el, melyik ár kerül a költségvetésbe",
        tone: "warning",
        actionable: true,
        action: "pick_subcontractor",
      }
    }
    if (summary.rfqCount === 0) {
      return {
        label: "Küldj árbekérést alvállalkozónak",
        detail: `${summary.rfqPendingCount} tételhez kell alvállalkozói ár`,
        tone: "warning",
        actionable: true,
        action: "send_rfq",
      }
    }
    return {
      label: "Várj az alvállalkozó válaszára",
      detail: `${summary.rfqPendingCount} tétel ára még hiányzik a bekérés miatt`,
      tone: "neutral",
      actionable: true,
      action: "view_subcontractors",
    }
  }

  if (summary.unpricedCount > 0) {
    return {
      label: "Add meg az árakat",
      detail: `${summary.unpricedCount} tételnél még nincs bekerülési ár`,
      tone: "warning",
      actionable: true,
      action: "open_editor",
    }
  }

  const marginPct = quoteDisplayMarginPercent(summary)
  if (
    marginPct != null &&
    !summary.isPartialTotal &&
    marginPct < getMinAcceptableMarginPercent()
  ) {
    return {
      label: "Emeld a fedezetet",
      detail: `Jelenleg csak ${marginPct}% marad — növeld az ügyfél árat vagy csökkentsd a bekerülést`,
      tone: "warning",
      actionable: true,
      action: "open_editor",
    }
  }

  const clientTodo = clientStatusTodo(quote.status, summary.readiness.canSend)
  if (clientTodo) return clientTodo

  if (summary.readiness.blockers.length > 0) {
    return {
      label: "Fejezd be a költségvetést",
      detail: summary.readiness.blockers[0],
      tone: "warning",
      actionable: true,
      action: "open_editor",
    }
  }

  return {
    label: "Minden rendben",
    detail: "Ehhez a szakághoz nincs teendő",
    tone: "success",
    actionable: false,
    action: "none",
  }
}

export function quoteReadinessPercent(summary: QuoteSummary): number {
  if (summary.lineCount === 0) return 0
  return summary.pricedPercent
}

/** TodoCell alatti rövid útmutató a kattintáshoz */
export function quoteTodoActionHint(action: QuoteTodoAction): string | null {
  switch (action) {
    case "open_editor":
      return "Megnyitás →"
    case "pick_subcontractor":
      return "Döntés →"
    case "view_subcontractors":
      return "Bekérések →"
    case "send_rfq":
      return "Bekérés indítása →"
    case "send_to_client":
      return "Megnyitás →"
    default:
      return null
  }
}
