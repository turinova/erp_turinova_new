"use client"

import { cn } from "@/lib/utils"
import type {
  PricingProgress,
  SubcontractorProgress,
} from "@/lib/quote-trade-progress"

export function PricingProgressCell({
  progress,
  size = "md",
}: {
  progress: PricingProgress
  size?: "md" | "lg"
}) {
  const { priced, total, percent } = progress
  if (total === 0) {
    return <span className="text-base text-slate-400">—</span>
  }

  const barTone =
    percent >= 100 ? "bg-emerald-600" : percent > 0 ? "bg-amber-500" : "bg-slate-300"

  return (
    <div className={cn("min-w-[7.5rem]", size === "lg" && "min-w-[9rem]")}>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className={cn("h-full rounded-full transition-all", barTone)}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
      <p
        className={cn(
          "mt-1.5 font-bold tabular-nums text-slate-900",
          size === "lg" ? "text-base" : "text-sm sm:text-base"
        )}
      >
        {priced} / {total}
      </p>
      <p className="text-sm font-medium text-slate-600">{percent}% beárazva</p>
    </div>
  )
}

export function SubcontractorProgressCell({
  progress,
  size = "md",
}: {
  progress: SubcontractorProgress
  size?: "md" | "lg"
}) {
  return (
    <div className="min-w-[8rem] max-w-[14rem]">
      <p
        className={cn(
          "font-semibold leading-snug",
          size === "lg" ? "text-base" : "text-sm sm:text-base",
          progress.tone === "warning" && "text-amber-950",
          progress.tone === "success" && "text-emerald-900",
          progress.tone === "neutral" && "text-slate-800",
          progress.tone === "muted" && "text-slate-400"
        )}
      >
        {progress.label}
      </p>
      {progress.detail ? (
        <p className="mt-0.5 text-sm leading-snug text-slate-600">{progress.detail}</p>
      ) : null}
    </div>
  )
}
