"use client"

import type { buildOverviewKpis } from "@/lib/project-overview-dashboard"
import { getMinAcceptableMarginPercent } from "@/lib/quote-summary"
import { formatHuf } from "@/lib/pricing"
import { cn } from "@/lib/utils"

type Kpis = ReturnType<typeof buildOverviewKpis>

type ProjectOverviewFinancialSummaryProps = {
  kpis: Kpis
  /** Ajánlatkészítés: árazatlan tételek száma (szakág-sorokból) */
  unpricedCount?: number
}

/**
 * Munka fül: max 3 szám egy sorban — nem dashboard.
 */
export function ProjectOverviewFinancialSummary({
  kpis,
  unpricedCount = 0,
}: ProjectOverviewFinancialSummaryProps) {
  if (!kpis.hasData) return null

  if (kpis.mode === "execution") {
    const marginLow =
      kpis.marginPercentOnContract != null &&
      kpis.marginPercentOnContract < getMinAcceptableMarginPercent()

    const contractSub =
      kpis.supplementGross > 0
        ? `Alap ${formatHuf(kpis.baseGross)} + pótmunka ${formatHuf(kpis.supplementGross)}`
        : kpis.contractSellNet > 0
          ? `Nettó ${formatHuf(kpis.contractSellNet)}`
          : undefined

    return (
      <section
        className="grid grid-cols-1 gap-4 border-b border-slate-200 pb-4 sm:grid-cols-3 sm:gap-6"
        aria-label="Összegzés"
      >
        <Stat
          label="Bruttó szerződés"
          value={kpis.contractGross > 0 ? formatHuf(kpis.contractGross) : "—"}
          sub={contractSub}
          emphasis
        />
        <Stat
          label="Fedezet"
          value={kpis.liveMarginNet !== 0 ? formatHuf(kpis.liveMarginNet) : "—"}
          sub={
            kpis.marginPercentOnContract != null
              ? `${kpis.marginPercentOnContract}% a szerződéshez`
              : undefined
          }
          tone={marginLow ? "caution" : kpis.liveMarginNet > 0 ? "positive" : "default"}
        />
        <Stat
          label="Készültség"
          value={
            kpis.executionTotal > 0
              ? `${kpis.executionResolved} / ${kpis.executionTotal}`
              : "—"
          }
          sub={
            kpis.executionTotal > 0
              ? kpis.executionSkipped > 0
                ? `${kpis.executionPercent}% lezárva · ${kpis.executionDone} kész · ${kpis.executionSkipped} nem kell`
                : `${kpis.executionPercent}% kész`
              : "elfogadott tételek"
          }
          tone={kpis.executionPercent === 100 ? "positive" : "default"}
        />
      </section>
    )
  }

  const marginLow =
    kpis.marginPercentOnCost != null &&
    kpis.marginPercentOnCost < getMinAcceptableMarginPercent()

  const marginSub =
    kpis.marginPercentOnCost != null && kpis.lineCount > 0
      ? `${kpis.marginPercentOnCost}%${
          marginLow ? ` · cél min. ${getMinAcceptableMarginPercent()}%` : ""
        }`
      : undefined

  const unpricedSub =
    kpis.lineCount === 0
      ? "Nincs tétel"
      : unpricedCount === 0
        ? "Minden tétel árazva"
        : `${kpis.lineCount} tételből`

  return (
    <section
      className="grid grid-cols-1 gap-4 border-b border-slate-200 pb-4 sm:grid-cols-3 sm:gap-6"
      aria-label="Összegzés"
    >
      <Stat
        label="Bruttó ügyfélnek"
        value={kpis.sellGross > 0 ? formatHuf(kpis.sellGross) : "—"}
        sub={
          kpis.sellNet > 0
            ? `Nettó ${formatHuf(kpis.sellNet)}${kpis.isPartial ? " · részleges" : ""}`
            : undefined
        }
        emphasis
      />
      <Stat
        label="Fedezet"
        value={kpis.marginTotal !== 0 ? formatHuf(kpis.marginTotal) : "—"}
        sub={marginSub}
        tone={marginLow ? "caution" : kpis.marginTotal > 0 ? "positive" : "default"}
      />
      <Stat
        label="Árazatlan"
        value={kpis.lineCount === 0 ? "—" : String(unpricedCount)}
        sub={unpricedSub}
        tone={
          unpricedCount === 0 && kpis.lineCount > 0
            ? "positive"
            : unpricedCount > 0
              ? "caution"
              : "default"
        }
      />
    </section>
  )
}

function Stat({
  label,
  value,
  sub,
  emphasis = false,
  tone = "default",
}: {
  label: string
  value: string
  sub?: string
  emphasis?: boolean
  tone?: "default" | "positive" | "caution"
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</p>
      <p
        className={cn(
          "mt-1 truncate font-bold tabular-nums tracking-tight text-slate-950",
          emphasis ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl"
        )}
      >
        {value}
      </p>
      {sub ? (
        <p
          className={cn(
            "mt-1 truncate text-sm",
            tone === "positive" && "font-medium text-emerald-800",
            tone === "caution" && "font-medium text-amber-800",
            tone === "default" && "text-slate-600"
          )}
        >
          {sub}
        </p>
      ) : null}
    </div>
  )
}
