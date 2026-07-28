"use client"

import { ArrowRight } from "lucide-react"
import { formatHuf } from "@/lib/pricing"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type ProjectStatusStripProps = {
  /** Pl. „Árazás 62% · 3 szakág · 12 tétel vár alvállalkozói árra” */
  facts: string
  grossLabel?: string | null
  /** Csak kritikus (pl. lejárt bekérés) — nem napi coaching */
  alert?: {
    message: string
    actionLabel: string
    onAction: () => void
  } | null
}

/**
 * Projekt állapot — tények, nem „csináld ezt” mentorálás.
 */
export function ProjectStatusStrip({ facts, grossLabel, alert }: ProjectStatusStripProps) {
  return (
    <div className="mb-4 space-y-2">
      {alert ? (
        <section
          className="flex flex-col gap-3 rounded-xl border border-red-300/80 bg-red-50 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <p className="text-base font-semibold text-red-950">{alert.message}</p>
          <Button
            type="button"
            className="h-11 shrink-0 gap-2 px-5 text-sm font-semibold"
            onClick={alert.onAction}
          >
            {alert.actionLabel}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>
      ) : null}

      <section
        className={cn(
          "flex flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4 sm:px-5"
        )}
        aria-label="Projekt állapot"
      >
        <p className="text-base font-medium leading-snug text-slate-800">{facts}</p>
        {grossLabel ? (
          <p className="shrink-0 text-base font-bold tabular-nums text-slate-950 sm:text-lg">
            {grossLabel}
          </p>
        ) : null}
      </section>
    </div>
  )
}

export function formatStatusGross(amount: number): string | null {
  if (amount <= 0) return null
  return `Bruttó ${formatHuf(amount)}`
}
