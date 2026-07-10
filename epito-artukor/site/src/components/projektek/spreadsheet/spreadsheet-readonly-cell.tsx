import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import type { CellEditability } from "@/lib/quote-sheet-editability"

type SpreadsheetReadonlyCellProps = {
  value: ReactNode
  variant?: Extract<CellEditability, "computed" | "meta" | "locked_rfq" | "locked_quote">
  align?: "left" | "right" | "center"
  title?: string
  className?: string
  truncate?: boolean
}

const variantClass: Record<NonNullable<SpreadsheetReadonlyCellProps["variant"]>, string> = {
  computed: "ea-sheet-readonly-computed",
  meta: "ea-sheet-readonly-meta",
  locked_rfq: "ea-sheet-readonly-locked",
  locked_quote: "ea-sheet-readonly-locked",
}

export function SpreadsheetReadonlyCell({
  value,
  variant = "computed",
  align = "right",
  title,
  className,
  truncate = false,
}: SpreadsheetReadonlyCellProps) {
  return (
    <span
      title={title}
      className={cn(
        "ea-sheet-readonly block px-1 text-xs tabular-nums",
        variantClass[variant],
        align === "right" && "text-right",
        align === "center" && "text-center",
        align === "left" && "text-left",
        truncate && "truncate",
        className
      )}
    >
      {value}
    </span>
  )
}

type SheetHeaderCellProps = {
  label: string
  sub?: string
  title?: string
  editable?: boolean
  align?: "left" | "right" | "center"
  colActive?: boolean
  className?: string
  children?: ReactNode
  nowrap?: boolean
}

export function SheetHeaderCell({
  label,
  sub,
  title,
  editable = false,
  align = "left",
  className,
  children,
  nowrap = false,
  colActive = false,
}: SheetHeaderCellProps) {
  const fullTitle = title ?? (sub ? `${label} (${sub})` : label)

  return (
    <th
      title={fullTitle}
      className={cn(
        editable ? "ea-sheet-head-editable" : "ea-sheet-head-readonly",
        align === "right" && "text-right",
        align === "center" && "text-center",
        sub && "ea-sheet-head-stacked",
        nowrap && "ea-sheet-head-nowrap",
        colActive && "ea-worksheet-col-active",
        className
      )}
    >
      {children ?? (
        <>
          <span
            className={cn(
              "block leading-tight",
              sub || nowrap ? "whitespace-nowrap" : "truncate"
            )}
            title={fullTitle}
          >
            {label}
          </span>
          {sub ? (
            <span className="mt-0.5 block whitespace-nowrap text-[9px] font-normal normal-case leading-tight text-slate-500">
              {sub}
            </span>
          ) : null}
        </>
      )}
    </th>
  )
}

type SheetFooterLabelCellProps = {
  label: string
  sub?: string
  className?: string
  colSpan?: number
}

export function SheetFooterLabelCell({
  label,
  sub,
  className,
  colSpan,
}: SheetFooterLabelCellProps) {
  return (
    <td colSpan={colSpan} className={cn("font-semibold", className)}>
      <span className="block leading-tight">{label}</span>
      {sub ? (
        <span className="mt-0.5 block text-[9px] font-normal normal-case text-slate-600">
          {sub}
        </span>
      ) : null}
    </td>
  )
}
