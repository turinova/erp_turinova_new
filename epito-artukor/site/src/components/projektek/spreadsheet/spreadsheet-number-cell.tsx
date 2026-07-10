"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  COST_SHEET_COLS,
  focusSheetCell,
  navigateSheetRowCol,
  parseSheetNumber,
} from "@/lib/quote-spreadsheet"

const numericInputNoSpinner =
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"

type SpreadsheetNumberCellProps = {
  value: number
  sheetRow: number
  sheetCol: string
  maxRow: number
  cols?: readonly string[]
  gridRootRef: React.RefObject<HTMLElement | null>
  active: boolean
  onActivate: (row: number, col: string) => void
  onChange: (value: number) => void
  className?: string
  align?: "left" | "right"
  disabled?: boolean
  title?: string
}

export function SpreadsheetNumberCell({
  value,
  sheetRow,
  sheetCol,
  maxRow,
  cols = COST_SHEET_COLS,
  gridRootRef,
  active,
  onActivate,
  onChange,
  className,
  align = "right",
  disabled,
  title,
}: SpreadsheetNumberCellProps) {
  const [draft, setDraft] = useState(() => (value > 0 ? String(value) : ""))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setDraft(value > 0 ? String(value) : "")
  }, [value, focused])

  const commit = () => {
    const num = parseSheetNumber(draft)
    if (num != null && num !== value) onChange(num)
    else if (draft.trim() === "" && value !== 0) onChange(0)
    setFocused(false)
  }

  const handleNav = (direction: "up" | "down" | "left" | "right") => {
    const next = navigateSheetRowCol(sheetRow, sheetCol, direction, maxRow, cols)
    onActivate(next.row, next.col)
    focusSheetCell(gridRootRef.current, next.row, next.col)
  }

  return (
    <Input
      type="text"
      inputMode="decimal"
      disabled={disabled}
      title={title}
      data-sheet-row={sheetRow}
      data-sheet-col={sheetCol}
      className={cn(
        "ea-sheet-input h-6 min-h-6 w-full max-w-full rounded-none border-0 bg-transparent px-1 py-0 text-xs shadow-none focus-visible:ring-2 focus-visible:ring-blue-500",
        numericInputNoSpinner,
        align === "right" && "text-right tabular-nums",
        active && !focused && "ring-2 ring-inset ring-blue-400",
        className
      )}
      value={draft}
      placeholder="0"
      onFocus={() => {
        setFocused(true)
        onActivate(sheetRow, sheetCol)
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault()
          commit()
          handleNav(e.shiftKey ? "up" : "down")
          return
        }
        if (e.key === "Tab") {
          e.preventDefault()
          commit()
          handleNav(e.shiftKey ? "left" : "right")
          return
        }
        if (e.key === "ArrowUp") {
          e.preventDefault()
          commit()
          handleNav("up")
          return
        }
        if (e.key === "ArrowDown") {
          e.preventDefault()
          commit()
          handleNav("down")
          return
        }
        if (e.key === "ArrowLeft" && (e.currentTarget.selectionStart ?? 0) === 0) {
          e.preventDefault()
          commit()
          handleNav("left")
          return
        }
        if (
          e.key === "ArrowRight" &&
          (e.currentTarget.selectionStart ?? 0) === e.currentTarget.value.length
        ) {
          e.preventDefault()
          commit()
          handleNav("right")
          return
        }
        if (e.key === "Escape") {
          setDraft(value > 0 ? String(value) : "")
          e.currentTarget.blur()
        }
      }}
    />
  )
}
