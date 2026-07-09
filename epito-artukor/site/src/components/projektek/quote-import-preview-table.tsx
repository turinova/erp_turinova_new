"use client"

import { useMemo } from "react"
import type { Quote } from "@/types/projects"
import type { QuoteImportPreviewRow } from "@/lib/cost-items/quote-import-types"
import { validateQuoteImportPreviewRow } from "@/lib/cost-items/build-quote-import-preview"
import { getTradeLabel } from "@/lib/trades"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type CatalogOption = {
  id: string
  text: string
  trade: string
  identifier: string
}

type QuoteImportPreviewTableProps = {
  groups: Array<{
    trade: string
    tradeLabel: string
    targetQuoteId: string | null
    targetQuoteLabel: string
    rows: QuoteImportPreviewRow[]
  }>
  rows: QuoteImportPreviewRow[]
  catalogItems: CatalogOption[]
  existingQuotes: Array<Pick<Quote, "id" | "title" | "primaryTrade" | "status">>
  onChange: (rows: QuoteImportPreviewRow[]) => void
}

const previewSelectTriggerClass =
  "h-auto min-h-9 w-full min-w-[10rem] py-1.5 text-left text-xs [&>span]:line-clamp-none [&>span]:whitespace-normal"

function confidenceVariant(score: number): "success" | "warning" | "secondary" {
  if (score >= 75) return "success"
  if (score >= 50) return "warning"
  return "secondary"
}

function matchSourceLabel(source: QuoteImportPreviewRow["matchSource"]): string {
  if (source === "identifier") return "Azonosító"
  if (source === "fuzzy") return "Szöveg"
  if (source === "local") return "Kulcsszó"
  if (source === "ai") return "AI"
  return "—"
}

export function QuoteImportPreviewTable({
  groups,
  rows,
  catalogItems,
  existingQuotes,
  onChange,
}: QuoteImportPreviewTableProps) {
  const catalogById = useMemo(() => new Map(catalogItems.map((c) => [c.id, c])), [catalogItems])

  const quotesForTrade = (trade: string) =>
    existingQuotes.filter(
      (q) => q.primaryTrade === trade && q.status !== "archived" && q.status !== "rejected"
    )

  const updateRow = (lineNumber: number, patch: Partial<QuoteImportPreviewRow>) => {
    const next = rows.map((row) => {
      if (row.lineNumber !== lineNumber) return row

      let updated = { ...row, ...patch }

      if (patch.matchedCostItemId !== undefined) {
        const item = patch.matchedCostItemId
          ? catalogById.get(patch.matchedCostItemId)
          : undefined
        updated.matchedText = item?.text ?? null
        updated.trade = item?.trade ?? null
        updated.matchScore = patch.matchedCostItemId ? Math.max(updated.matchScore, 80) : 0
        updated.matchSource = patch.matchedCostItemId ? "local" : "none"

        if (item?.trade) {
          const tradeQuotes = quotesForTrade(item.trade)
          const draft = tradeQuotes.find((q) => q.status === "draft")
          const target = draft ?? tradeQuotes[0]
          if (target) {
            updated.targetQuoteId = target.id
            updated.targetQuoteAction = "EXISTING"
            updated.targetQuoteLabel = target.title
          } else {
            updated.targetQuoteId = null
            updated.targetQuoteAction = "CREATE"
            updated.targetQuoteLabel = `${getTradeLabel(item.trade)} (új)`
          }
        }
      }

      return validateQuoteImportPreviewRow(updated, existingQuotes as Quote[], catalogItems)
    })
    onChange(next)
  }

  const candidateOptionsForRow = (row: QuoteImportPreviewRow): CatalogOption[] => {
    const ids = new Set<string>()
    const options: CatalogOption[] = []
    if (row.matchedCostItemId) {
      const primary = catalogById.get(row.matchedCostItemId)
      if (primary) {
        ids.add(primary.id)
        options.push(primary)
      }
    }
    for (const alt of row.alternatives) {
      if (!alt.itemId || ids.has(alt.itemId)) continue
      const item = catalogById.get(alt.itemId)
      if (item) {
        ids.add(item.id)
        options.push(item)
      }
    }
    if (row.trade) {
      for (const item of catalogItems) {
        if (item.trade === row.trade && !ids.has(item.id)) {
          ids.add(item.id)
          options.push(item)
          if (options.length >= 12) break
        }
      }
    }
    return options
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.trade} className="overflow-hidden rounded-lg border bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-slate-50 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">{group.tradeLabel}</span>
              <Badge variant="secondary">{group.rows.length} tétel</Badge>
            </div>
            <span className="text-xs text-slate-600">→ {group.targetQuoteLabel}</span>
          </div>
          <div className="max-h-[28rem] overflow-x-auto overflow-y-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="ea-table-head sticky top-0 z-10">
                <tr>
                  <th className="w-10 px-2 py-2" />
                  <th className="px-3 py-2 text-left">Beillesztett szöveg</th>
                  <th className="px-3 py-2 text-left">Párosított K-tétel</th>
                  <th className="px-3 py-2 text-left">Egyezés</th>
                  <th className="w-24 px-3 py-2 text-left">Menny.</th>
                  <th className="px-3 py-2 text-left">Cél költségvetés</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row) => {
                  const candidates = candidateOptionsForRow(row)
                  const tradeQuotes = row.trade ? quotesForTrade(row.trade) : []

                  return (
                    <tr
                      key={row.lineNumber}
                      className={cn(
                        "border-t border-slate-100",
                        !row.included && "opacity-50",
                        row.errors.length > 0 && "bg-red-50/40"
                      )}
                    >
                      <td className="px-2 py-2 align-top">
                        <Checkbox
                          checked={row.included}
                          disabled={row.errors.length > 0 && !row.matchedCostItemId}
                          onCheckedChange={(checked) =>
                            updateRow(row.lineNumber, { included: checked === true })
                          }
                        />
                      </td>
                      <td className="max-w-[16rem] px-3 py-2 align-top text-xs text-slate-700">
                        <p className="whitespace-normal break-words">{row.rawInput}</p>
                        {row.warnings.map((w) => (
                          <p key={w} className="mt-1 text-amber-700">
                            {w}
                          </p>
                        ))}
                        {row.errors.map((e) => (
                          <p key={e} className="mt-1 text-red-600">
                            {e}
                          </p>
                        ))}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {candidates.length > 0 ? (
                          <Select
                            value={row.matchedCostItemId ?? ""}
                            onValueChange={(value) =>
                              updateRow(row.lineNumber, {
                                matchedCostItemId: value || null,
                              })
                            }
                          >
                            <SelectTrigger className={previewSelectTriggerClass}>
                              <SelectValue placeholder="Válassz K-tételt…" />
                            </SelectTrigger>
                            <SelectContent>
                              {candidates.map((item) => (
                                <SelectItem key={item.id} value={item.id} className="text-xs">
                                  {item.identifier} — {item.text.slice(0, 80)}
                                  {item.text.length > 80 ? "…" : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-xs text-red-600">Nincs találat</span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {row.matchedCostItemId ? (
                          <div className="flex flex-col gap-1">
                            <Badge variant={confidenceVariant(row.matchScore)}>
                              {row.matchScore}% · {matchSourceLabel(row.matchSource)}
                            </Badge>
                          </div>
                        ) : (
                          <Badge variant="secondary">Nincs párosítás</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <Input
                          type="number"
                          min={0}
                          step="any"
                          className="h-8 w-20 text-xs"
                          value={row.quantity}
                          onChange={(e) => {
                            const qty = Number.parseFloat(e.target.value.replace(",", "."))
                            updateRow(row.lineNumber, {
                              quantity: Number.isFinite(qty) && qty > 0 ? qty : 1,
                            })
                          }}
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <Select
                          value={row.targetQuoteId ?? "__new__"}
                          onValueChange={(value) => {
                            if (value === "__new__") {
                              updateRow(row.lineNumber, {
                                targetQuoteId: null,
                                targetQuoteAction: "CREATE",
                                targetQuoteLabel: row.trade
                                  ? `${getTradeLabel(row.trade)} (új)`
                                  : null,
                              })
                            } else {
                              const quote = existingQuotes.find((q) => q.id === value)
                              updateRow(row.lineNumber, {
                                targetQuoteId: value,
                                targetQuoteAction: "EXISTING",
                                targetQuoteLabel: quote?.title ?? null,
                              })
                            }
                          }}
                        >
                          <SelectTrigger className={previewSelectTriggerClass}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__new__" className="text-xs">
                              {row.trade
                                ? `${getTradeLabel(row.trade)} (új költségvetés)`
                                : "Új költségvetés"}
                            </SelectItem>
                            {tradeQuotes.map((q) => (
                              <SelectItem key={q.id} value={q.id} className="text-xs">
                                {q.title} ({q.status})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
