"use client"

import { useMemo } from "react"
import type { Category, Unit } from "@/types"
import {
  getCategoriesForTradeSelect,
  getDefaultCategoryForTrade,
} from "@/lib/categories/category-tree"
import {
  computePreviewIdentifiers,
  type IdentifierPoolItem,
  type PastePreviewRow,
} from "@/lib/cost-items/paste-import"
import { validatePastePreviewRow } from "@/lib/cost-items/paste-import"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type TradeOption = { id: string; code: string; name: string }

/** Select trigger: teljes szöveg látszik, nem vág le egy sorra */
const previewSelectTriggerClass =
  "h-auto min-h-9 w-full min-w-[12rem] py-1.5 text-left text-xs [&>span]:line-clamp-none [&>span]:whitespace-normal"

type PasteImportPreviewTableProps = {
  rows: PastePreviewRow[]
  trades: TradeOption[]
  categories: Category[]
  units: Unit[]
  existingIdentifiers: IdentifierPoolItem[]
  onChange: (rows: PastePreviewRow[]) => void
}

function confidenceVariant(confidence: number): "success" | "warning" | "secondary" {
  if (confidence >= 75) return "success"
  if (confidence >= 50) return "warning"
  return "secondary"
}

export function PasteImportPreviewTable({
  rows,
  trades,
  categories,
  units,
  existingIdentifiers,
  onChange,
}: PasteImportPreviewTableProps) {
  const tradeCodeById = useMemo(
    () => new Map(trades.map((t) => [t.id, t.code])),
    [trades]
  )

  const tradeNameById = useMemo(() => new Map(trades.map((t) => [t.id, t.name])), [trades])

  const categoryLabelById = useMemo(
    () => new Map(categories.map((c) => [c.id, `${c.code} — ${c.name}`])),
    [categories]
  )

  const previewIdentifiers = useMemo(
    () => computePreviewIdentifiers(rows, categories, existingIdentifiers),
    [rows, categories, existingIdentifiers]
  )

  const updateRow = (rowNumber: number, patch: Partial<PastePreviewRow>) => {
    onChange(
      rows.map((row) => {
        if (row.rowNumber !== rowNumber) return row
        let next = { ...row, ...patch }

        if (patch.tradeId !== undefined && patch.tradeId !== row.tradeId) {
          const tradeCode = patch.tradeId ? tradeCodeById.get(patch.tradeId) : undefined
          if (tradeCode) {
            const defaultCategory = getDefaultCategoryForTrade(tradeCode, categories)
            next.categoryId = defaultCategory || null
          } else {
            next.categoryId = null
          }
        }

        return validatePastePreviewRow(next, trades, categories)
      })
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
      <div className="max-h-[36rem] overflow-x-auto overflow-y-auto">
        <table className="w-full min-w-[1280px] text-sm">
          <thead className="ea-table-head sticky top-0 z-10">
            <tr>
              <th className="w-10 px-2 py-2" />
              <th className="w-12 px-2 py-2 text-left">Sor</th>
              <th className="min-w-[7rem] px-2 py-2 text-left">Tételszám</th>
              <th className="min-w-[280px] px-2 py-2 text-left">Tétel szövege</th>
              <th className="min-w-[200px] px-2 py-2 text-left">Szakág</th>
              <th className="min-w-[240px] px-2 py-2 text-left">Kategória</th>
              <th className="w-20 px-2 py-2 text-left">ME</th>
              <th className="w-20 px-2 py-2 text-right">Anyag</th>
              <th className="w-20 px-2 py-2 text-right">Díj</th>
              <th className="w-16 px-2 py-2 text-center">AI</th>
              <th className="min-w-[160px] px-2 py-2 text-left">Státusz</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const tradeCode = row.tradeId ? tradeCodeById.get(row.tradeId) : undefined
              const categoryOptions = tradeCode
                ? getCategoriesForTradeSelect(tradeCode, categories)
                : []
              const previewId = previewIdentifiers.get(row.rowNumber) ?? "—"

              return (
                <tr
                  key={row.rowNumber}
                  className={cn(
                    "border-b align-top",
                    !row.included && "opacity-50",
                    row.errors.length > 0 ? "bg-red-50/60" : "",
                    row.errors.length === 0 && row.warnings.length > 0 ? "bg-amber-50/50" : ""
                  )}
                >
                  <td className="px-2 py-2">
                    <Checkbox
                      checked={row.included}
                      onCheckedChange={(checked) =>
                        updateRow(row.rowNumber, { included: checked === true })
                      }
                    />
                  </td>
                  <td className="px-2 py-2 text-slate-500">{row.rowNumber}</td>
                  <td className="px-2 py-2">
                    <span
                      className="font-code text-xs font-medium text-[var(--page-accent)]"
                      title={previewId}
                    >
                      {previewId}
                    </span>
                  </td>
                  <td className="min-w-[280px] px-2 py-2">
                    <Textarea
                      value={row.text}
                      onChange={(e) => updateRow(row.rowNumber, { text: e.target.value })}
                      rows={Math.min(4, Math.max(2, Math.ceil(row.text.length / 48)))}
                      className="min-h-[2.5rem] resize-y text-xs leading-snug"
                    />
                  </td>
                  <td className="min-w-[200px] px-2 py-2">
                    <Select
                      value={row.tradeId ?? ""}
                      onValueChange={(v) => updateRow(row.rowNumber, { tradeId: v || null })}
                    >
                      <SelectTrigger className={previewSelectTriggerClass}>
                        <SelectValue placeholder="Szakág…">
                          {row.tradeId ? tradeNameById.get(row.tradeId) : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="max-w-md">
                        {trades.map((t) => (
                          <SelectItem key={t.id} value={t.id} className="whitespace-normal">
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="min-w-[240px] px-2 py-2">
                    <Select
                      value={row.categoryId ?? ""}
                      onValueChange={(v) => updateRow(row.rowNumber, { categoryId: v || null })}
                      disabled={!tradeCode}
                    >
                      <SelectTrigger className={previewSelectTriggerClass}>
                        <SelectValue placeholder="Kategória…">
                          {row.categoryId ? categoryLabelById.get(row.categoryId) : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="max-w-lg">
                        {categoryOptions.map((c) => (
                          <SelectItem
                            key={c.id}
                            value={c.id}
                            className="whitespace-normal py-2"
                          >
                            {c.code} — {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-2 py-2">
                    <Select
                      value={row.unitId ?? ""}
                      onValueChange={(v) => updateRow(row.rowNumber, { unitId: v || null })}
                    >
                      <SelectTrigger className="h-9 w-20 text-xs">
                        <SelectValue placeholder="ME" />
                      </SelectTrigger>
                      <SelectContent>
                        {units.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      type="number"
                      min={0}
                      value={row.materialUnitPrice}
                      onChange={(e) =>
                        updateRow(row.rowNumber, {
                          materialUnitPrice: Number.parseInt(e.target.value, 10) || 0,
                        })
                      }
                      className="h-9 w-20 text-right font-code text-xs"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      type="number"
                      min={0}
                      value={row.laborUnitPrice}
                      onChange={(e) =>
                        updateRow(row.rowNumber, {
                          laborUnitPrice: Number.parseInt(e.target.value, 10) || 0,
                        })
                      }
                      className="h-9 w-20 text-right font-code text-xs"
                    />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <Badge variant={confidenceVariant(row.confidence)} className="font-code text-xs">
                      {row.confidence}%
                    </Badge>
                  </td>
                  <td className="px-2 py-2">
                    {row.errors.length > 0 ? (
                      <span className="text-xs leading-snug text-red-600">{row.errors.join(" ")}</span>
                    ) : row.warnings.length > 0 ? (
                      <span className="text-xs leading-snug text-amber-700">{row.warnings[0]}</span>
                    ) : (
                      <span className="text-xs text-emerald-600">OK</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
