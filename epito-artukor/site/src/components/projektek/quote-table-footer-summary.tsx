"use client"

import { cn } from "@/lib/utils"

export type QuoteTableFooterCellTone =
  | "cost"
  | "material"
  | "labor"
  | "blue"
  | "emerald"
  | "amber"

export type QuoteTableFooterCell = {
  label: string
  value: string
  tone?: QuoteTableFooterCellTone
  suffix?: string
  emphasis?: boolean
}

type QuoteTableFooterSummaryProps = {
  label: string
  cells: QuoteTableFooterCell[]
  partialWarning?: boolean
}

const cellToneClass: Record<
  QuoteTableFooterCellTone,
  { box: string; label: string; value: string }
> = {
  cost: {
    box: "border-2 border-zinc-400 bg-zinc-100",
    label: "text-zinc-700",
    value: "text-zinc-950",
  },
  material: {
    box: "border-2 border-amber-400 bg-amber-100",
    label: "text-amber-900",
    value: "text-amber-950",
  },
  labor: {
    box: "border-2 border-violet-400 bg-violet-100",
    label: "text-violet-900",
    value: "text-violet-950",
  },
  blue: {
    box: "border-2 border-blue-400 bg-blue-100",
    label: "text-blue-900",
    value: "text-blue-950",
  },
  emerald: {
    box: "border-2 border-emerald-400 bg-emerald-100",
    label: "text-emerald-900",
    value: "text-emerald-950",
  },
  amber: {
    box: "border-2 border-amber-500 bg-amber-100",
    label: "text-amber-950",
    value: "text-amber-950",
  },
}

export function QuoteTableFooterSummary({
  label,
  cells,
  partialWarning,
}: QuoteTableFooterSummaryProps) {
  return (
    <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-5 py-4 shadow-[0_-1px_3px_rgba(15,23,42,0.06)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <p className="shrink-0 text-sm font-semibold text-slate-800">{label}</p>
        <div
          className={cn(
            "grid w-full gap-2.5",
            cells.length >= 4
              ? "grid-cols-2 sm:grid-cols-4"
              : cells.length === 2
                ? "grid-cols-2"
                : "grid-cols-3",
            "sm:ml-auto sm:max-w-4xl"
          )}
        >
          {cells.map((cell) => {
            const tone = cellToneClass[cell.tone ?? "cost"]
            return (
              <div
                key={cell.label}
                className={cn(
                  "min-w-0 rounded-lg px-3 py-2.5",
                  tone.box
                )}
              >
                <p className={cn("text-xs font-bold uppercase tracking-wide", tone.label)}>
                  {cell.label}
                </p>
                <p
                  className={cn(
                    "mt-1 truncate tabular-nums",
                    cell.emphasis ? "text-lg font-bold sm:text-xl" : "text-base font-bold",
                    tone.value
                  )}
                >
                  {cell.value}
                  {cell.suffix ? (
                    <span className="ml-1.5 text-sm font-semibold opacity-90">
                      {cell.suffix}
                    </span>
                  ) : null}
                </p>
              </div>
            )
          })}
        </div>
      </div>
      {partialWarning ? (
        <p className="mt-2 text-sm font-medium text-amber-800">* Részleges — csak árazott tételek</p>
      ) : null}
    </div>
  )
}
