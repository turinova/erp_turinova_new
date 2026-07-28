/**
 * Szakáglista állapot — tények, nem coaching.
 * Építésvezető: mennyi van beárazva, hol tart az alvállalkozói ár.
 */

export type PricingProgress = {
  priced: number
  total: number
  percent: number
}

export type SubcontractorProgressTone = "neutral" | "warning" | "success" | "muted"

export type SubcontractorProgress = {
  /** Rövid fősor, pl. „8 vár árra” */
  label: string
  /** Opcionális alsó sor */
  detail?: string
  tone: SubcontractorProgressTone
}

export function pricingProgress(pricedCount: number, lineCount: number): PricingProgress {
  const total = Math.max(0, lineCount)
  const priced = Math.min(Math.max(0, pricedCount), total)
  const percent = total > 0 ? Math.round((priced / total) * 100) : 0
  return { priced, total, percent }
}

type SubcontractorInput = {
  lineCount: number
  rfqPendingCount: number
  rfqCount: number
  rfqSubmissionCount: number
  rfqAwaitingCount: number
  unappliedSubmissionCount: number
}

/**
 * Alvállalkozói állapot emberi tényként — nincs „Indíts bekérést!” utasítás.
 */
export function subcontractorProgress(input: SubcontractorInput): SubcontractorProgress {
  const {
    lineCount,
    rfqPendingCount,
    rfqCount,
    rfqSubmissionCount,
    rfqAwaitingCount,
    unappliedSubmissionCount,
  } = input

  if (lineCount === 0) {
    return { label: "—", tone: "muted" }
  }

  if (unappliedSubmissionCount > 0) {
    return {
      label:
        unappliedSubmissionCount === 1
          ? "1 válasz · döntésre"
          : `${unappliedSubmissionCount} válasz · döntésre`,
      detail: "Beérkezett, még nincs a költségvetésben",
      tone: "warning",
    }
  }

  if (rfqPendingCount > 0) {
    if (rfqCount === 0) {
      return {
        label: rfqPendingCount === 1 ? "1 vár árra" : `${rfqPendingCount} vár árra`,
        detail: "Még nincs kiküldött bekérés",
        tone: "warning",
      }
    }
    if (rfqSubmissionCount > 0 && rfqAwaitingCount > 0) {
      return {
        label: `${rfqSubmissionCount} válasz · ${rfqAwaitingCount} még vár`,
        tone: "warning",
      }
    }
    if (rfqAwaitingCount > 0 && rfqSubmissionCount === 0) {
      return {
        label: rfqAwaitingCount === 1 ? "Vár válasz · 1 cég" : `Vár válasz · ${rfqAwaitingCount} cég`,
        detail: `${rfqPendingCount} tétel bekérésben`,
        tone: "neutral",
      }
    }
    if (rfqSubmissionCount > 0) {
      return {
        label:
          rfqSubmissionCount === 1
            ? "1 válasz · döntésre"
            : `${rfqSubmissionCount} válasz · döntésre`,
        tone: "warning",
      }
    }
    return {
      label: `${rfqPendingCount} vár árra`,
      detail: rfqCount > 0 ? `${rfqCount} bekérés` : undefined,
      tone: "warning",
    }
  }

  if (rfqCount > 0) {
    return { label: "Kész", detail: "Alvállalkozói árak megvannak", tone: "success" }
  }

  return { label: "—", tone: "muted" }
}

/** Cím csak ha tényleg különbözik a szakág névtől (ne duplikátum). */
export function secondaryQuoteTitle(tradeLabel: string, quoteTitle: string): string | null {
  const a = tradeLabel.trim().toLocaleLowerCase("hu")
  const b = quoteTitle.trim().toLocaleLowerCase("hu")
  if (!b || a === b) return null
  // „Gépészet – valami” ahol a szakág Gépészet — mutassuk ha van érdemi toldalék
  if (b.startsWith(a) && b.length <= a.length + 2) return null
  return quoteTitle.trim()
}
