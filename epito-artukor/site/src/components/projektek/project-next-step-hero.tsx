"use client"

import { ArrowRight } from "lucide-react"
import type { OverviewHeroAction, OverviewHeroTone } from "@/lib/project-overview-dashboard"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ProjectNextStepHeroProps = {
  hero: OverviewHeroAction
  onAction: (hero: OverviewHeroAction) => void
}

function toneClasses(tone: OverviewHeroTone): {
  wrap: string
  title: string
  detail: string
} {
  switch (tone) {
    case "error":
      return {
        wrap: "border-red-300/80 bg-red-50",
        title: "text-red-950",
        detail: "text-red-900/80",
      }
    case "warning":
      return {
        wrap: "border-amber-300/80 bg-amber-50",
        title: "text-amber-950",
        detail: "text-amber-900/80",
      }
    case "success":
      return {
        wrap: "border-emerald-300/80 bg-emerald-50",
        title: "text-emerald-950",
        detail: "text-emerald-900/80",
      }
    case "info":
      return {
        wrap: "border-blue-300/80 bg-blue-50",
        title: "text-blue-950",
        detail: "text-blue-900/80",
      }
    default:
      return {
        wrap: "border-slate-200 bg-slate-50",
        title: "text-slate-950",
        detail: "text-slate-600",
      }
  }
}

export function ProjectNextStepHero({ hero, onAction }: ProjectNextStepHeroProps) {
  const tone = toneClasses(hero.tone)
  const showCta = hero.action !== "none"

  return (
    <section
      className={cn(
        "mb-4 flex flex-col gap-3 rounded-xl border px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5",
        tone.wrap
      )}
      aria-label="Következő lépés"
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Következő lépés
        </p>
        <p className={cn("mt-0.5 text-base font-semibold leading-snug sm:text-lg", tone.title)}>
          {hero.title}
        </p>
        {hero.detail ? (
          <p className={cn("mt-1 text-sm leading-relaxed", tone.detail)}>{hero.detail}</p>
        ) : null}
      </div>

      {showCta ? (
        <Button
          type="button"
          size="default"
          className="h-11 shrink-0 gap-2 px-5 text-sm font-semibold"
          onClick={() => onAction(hero)}
        >
          {hero.actionLabel}
          <ArrowRight className="h-4 w-4" />
        </Button>
      ) : null}
    </section>
  )
}
