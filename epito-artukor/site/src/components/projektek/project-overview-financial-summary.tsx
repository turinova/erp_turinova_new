"use client"

import type { ReactNode } from "react"
import type { buildOverviewKpis } from "@/lib/project-overview-dashboard"
import { getMinAcceptableMarginPercent } from "@/lib/quote-summary"
import { formatHuf } from "@/lib/pricing"
import {
  CUSTOMER_PACKAGE_TYPE_LABELS,
} from "@/lib/customer-package"
import { listCustomerPackagesForProject } from "@/lib/data/projects-store"
import { getProject } from "@/lib/data/projects-store"
import { cn } from "@/lib/utils"

type Kpis = ReturnType<typeof buildOverviewKpis>

type ProjectOverviewFinancialSummaryProps = {
  projectId: string
  kpis: Kpis
}

function Metric({
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
          "mt-1 truncate font-semibold tabular-nums tracking-tight text-slate-950",
          emphasis ? "text-2xl sm:text-[1.75rem] sm:leading-8" : "text-lg sm:text-xl"
        )}
      >
        {value}
      </p>
      {sub ? (
        <p
          className={cn(
            "mt-1 truncate text-sm tabular-nums",
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

function StatusPill({
  children,
  variant = "neutral",
}: {
  children: ReactNode
  variant?: "neutral" | "success" | "warning" | "info"
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        variant === "neutral" && "bg-slate-200 text-slate-800",
        variant === "success" && "bg-emerald-100 text-emerald-950 ring-1 ring-emerald-300/80",
        variant === "warning" && "bg-amber-100 text-amber-950 ring-1 ring-amber-300/80",
        variant === "info" && "bg-blue-100 text-blue-950 ring-1 ring-blue-300/80"
      )}
    >
      {children}
    </span>
  )
}

export function ProjectOverviewFinancialSummary({
  projectId,
  kpis,
}: ProjectOverviewFinancialSummaryProps) {
  if (!kpis.hasData) return null

  const acceptedPackages = listCustomerPackagesForProject(projectId).filter(
    (p) => p.status === "accepted"
  )

  if (kpis.mode === "execution") {
    const marginLow =
      kpis.marginPercentOnContract != null &&
      kpis.marginPercentOnContract < getMinAcceptableMarginPercent()
    const marginTone = marginLow ? "caution" : kpis.liveMarginNet > 0 ? "positive" : "default"
    const project = getProject(projectId)
    const isClosed = project?.status === "done"

    return (
      <section className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Projekt összesítő</h3>
            <p className="mt-0.5 text-sm text-slate-600">
              {isClosed ? "Lezárt projekt — szerződés és teljesítés" : "Szerződéses alap · élő bekerülés"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isClosed ? (
              <StatusPill variant="neutral">Lezárva</StatusPill>
            ) : (
              <StatusPill variant="success">Kivitelezés</StatusPill>
            )}
            {kpis.supplementGross > 0 ? (
              <StatusPill variant="info">Van pótmunka</StatusPill>
            ) : null}
            {marginLow ? <StatusPill variant="warning">Alacsony fedezet</StatusPill> : null}
          </div>
        </div>

        <div className="grid gap-6 px-5 py-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)] lg:items-end">
          <div className="border-b border-slate-100 pb-5 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Szerződéses összeg
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-slate-950 sm:text-4xl">
              {kpis.contractGross > 0 ? formatHuf(kpis.contractGross) : "—"}
            </p>
            <p className="mt-2 text-sm tabular-nums text-slate-600">
              Nettó{" "}
              <span className="font-semibold text-slate-800">
                {kpis.contractSellNet > 0 ? formatHuf(kpis.contractSellNet) : "—"}
              </span>
              {kpis.supplementGross > 0 ? (
                <span className="text-slate-500">
                  {" "}
                  · alap {formatHuf(kpis.baseGross)} + pótmunka {formatHuf(kpis.supplementGross)}
                </span>
              ) : null}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4 lg:grid-cols-5">
            <Metric
              label="Élő bekerülés"
              value={kpis.liveCostNet > 0 ? formatHuf(kpis.liveCostNet) : "—"}
              sub="elfogadott szakágok"
            />
            <Metric
              label="Élő fedezet"
              value={kpis.liveMarginNet !== 0 ? formatHuf(kpis.liveMarginNet) : "—"}
              sub={
                kpis.marginPercentOnContract != null
                  ? `${kpis.marginPercentOnContract}% a szerződéshez`
                  : undefined
              }
              tone={marginTone}
            />
            <Metric
              label="Szerződött szakág"
              value={kpis.contractTradeCount > 0 ? String(kpis.contractTradeCount) : "—"}
              sub="elfogadott csomagból"
            />
            <Metric
              label="Készültség"
              value={
                kpis.executionTotal > 0
                  ? `${kpis.executionDone} / ${kpis.executionTotal}`
                  : "—"
              }
              sub={
                kpis.executionTotal > 0 ? `${kpis.executionPercent}% kész` : "elfogadott tételek"
              }
              tone={kpis.executionPercent === 100 ? "positive" : "default"}
            />
            <Metric
              label="Pótmunka terv"
              value={kpis.draftQuoteCount > 0 ? String(kpis.draftQuoteCount) : "—"}
              sub={kpis.draftQuoteCount > 0 ? "piszkozat szakág" : "nincs"}
            />
          </div>
        </div>

        {acceptedPackages.length > 0 ? (
          <div className="border-t border-slate-100 px-5 py-3.5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Elfogadott árajánlatok ({acceptedPackages.length})
            </p>
            <ul className="flex flex-wrap gap-2">
              {acceptedPackages.map((pkg) => (
                <li
                  key={pkg.id}
                  className="inline-flex max-w-full flex-col rounded-lg border border-slate-200/90 bg-slate-50/80 px-2.5 py-1.5"
                >
                  <span className="truncate text-xs font-medium text-slate-900">{pkg.title}</span>
                  <span className="text-[10px] text-slate-600">
                    {CUSTOMER_PACKAGE_TYPE_LABELS[pkg.type]} ·{" "}
                    {formatHuf(pkg.grossTotal)} · {pkg.snapshots.length} költségvetés
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    )
  }

  const marginLow =
    kpis.marginPercentOnCost != null &&
    kpis.marginPercentOnCost < getMinAcceptableMarginPercent()

  const pricingTone =
    kpis.pricedPercent >= 100 ? "success" : kpis.pricedPercent >= 50 ? "warning" : "neutral"

  const marginTone = marginLow ? "caution" : kpis.marginTotal > 0 ? "positive" : "default"

  const marginSub =
    kpis.marginPercentOnCost != null && kpis.lineCount > 0
      ? `${kpis.marginPercentOnCost}% fedezet${
          kpis.marginPercentOnSell != null ? ` · ${kpis.marginPercentOnSell}% eladás` : ""
        }`
      : undefined

  const vatSub =
    kpis.mixedVat
      ? "Vegyes ÁFA"
      : kpis.vatAmount > 0
        ? `+${formatHuf(kpis.vatAmount)} · ${kpis.vatChip}`
        : undefined

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      {/* Fejléc */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Projekt összesítő</h3>
          <p className="mt-0.5 text-sm text-slate-600">Aktív szakágok · nettó / bruttó</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {kpis.lineCount > 0 ? (
            <StatusPill variant={pricingTone === "success" ? "success" : pricingTone === "warning" ? "warning" : "neutral"}>
              Árazás {kpis.pricedPercent}%
            </StatusPill>
          ) : null}
          {kpis.draftQuoteCount > 0 ? (
            <StatusPill variant="info">{kpis.draftQuoteCount} piszkozat</StatusPill>
          ) : null}
          {kpis.isPartial ? <StatusPill variant="warning">Részleges</StatusPill> : null}
          {marginLow ? <StatusPill variant="warning">Alacsony fedezet</StatusPill> : null}
        </div>
      </div>

      {/* Fő KPI + metrikák */}
      <div className="grid gap-6 px-5 py-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)] lg:items-end">
        {/* Hero: bruttó ügyfélár */}
        <div className="border-b border-slate-100 pb-5 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Bruttó ajánlat
          </p>
          <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-slate-950 sm:text-4xl">
            {kpis.sellGross > 0 ? formatHuf(kpis.sellGross) : "—"}
          </p>
          <p className="mt-2 text-sm tabular-nums text-slate-600">
            Nettó{" "}
            <span className="font-semibold text-slate-800">
              {kpis.sellNet > 0 ? formatHuf(kpis.sellNet) : "—"}
            </span>
            {vatSub ? <span className="text-slate-500"> · {vatSub}</span> : null}
          </p>
        </div>

        {/* Másodlagos metrikák */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
          <Metric
            label="Bekerülés"
            value={kpis.costNet > 0 ? formatHuf(kpis.costNet) : "—"}
            sub="nettó, ÁFA nélkül"
          />
          <Metric
            label="Fedezet"
            value={kpis.marginTotal !== 0 ? formatHuf(kpis.marginTotal) : "—"}
            sub={marginSub}
            tone={marginTone}
          />
          <Metric
            label="Fedezet %"
            value={
              kpis.marginPercentOnCost != null && kpis.lineCount > 0
                ? `${kpis.marginPercentOnCost}%`
                : "—"
            }
            sub={
              marginLow
                ? `Cél: min. ${getMinAcceptableMarginPercent()}%`
                : kpis.marginPercentOnSell != null
                  ? `${kpis.marginPercentOnSell}% az eladásból`
                  : undefined
            }
            tone={marginTone}
          />
          <Metric
            label="Tételek"
            value={kpis.lineCount > 0 ? String(kpis.lineCount) : "—"}
            sub={
              kpis.lineCount > 0
                ? `${kpis.pricedPercent}% árazva`
                : "Nincs tétel"
            }
          />
        </div>
      </div>

      {/* Árazás sáv */}
      {kpis.lineCount > 0 ? (
        <div className="border-t border-slate-100 bg-slate-50 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span className="shrink-0 text-sm font-semibold text-slate-700">Költségvetés készültség</span>
            <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-200">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  kpis.pricedPercent >= 100
                    ? "bg-emerald-600"
                    : kpis.pricedPercent >= 50
                      ? "bg-slate-700"
                      : "bg-amber-500"
                )}
                style={{ width: `${Math.min(100, kpis.pricedPercent)}%` }}
              />
            </div>
            <span className="shrink-0 text-sm font-bold tabular-nums text-slate-900">
              {kpis.pricedPercent}%
            </span>
          </div>
        </div>
      ) : null}
    </section>
  )
}
