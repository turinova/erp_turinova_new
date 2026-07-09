"use client"

import { Copy, MoreHorizontal, Pencil } from "lucide-react"
import type { Category, CostItem, CostItemStatus, Unit } from "@/types"
import type { ColumnId } from "@/lib/column-config"
import { getTradeLabel, getTradeOrder } from "@/lib/trades"
import { formatHuf } from "@/lib/pricing"
import { formatRelativeDate, freshnessClass, getPriceFreshness } from "@/lib/price-freshness"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getQuoteDisplayIdentifier } from "@/lib/item-identifier"
import { HighlightText } from "@/components/tetelek/highlight-text"
import { InlinePriceCell } from "@/components/tetelek/inline-price-cell"

const statusLabels: Record<CostItemStatus, string> = {
  active: "Aktív",
  draft: "Piszkozat",
  archived: "Archivált",
}

const statusVariant: Record<CostItemStatus, "success" | "warning" | "secondary"> = {
  active: "success",
  draft: "warning",
  archived: "secondary",
}

type CostItemRowProps = {
  item: CostItem
  searchQuery: string
  selected: boolean
  visibility: Record<ColumnId, boolean>
  unitsById: Record<string, Unit>
  categoryMap: Record<string, Category>
  onToggleSelect: () => void
  onOpenEdit: () => void
  onDuplicate: () => void
  onPriceChange: (field: "materialUnitPrice" | "laborUnitPrice", value: number) => void
}

export function CostItemRow({
  item,
  searchQuery,
  selected,
  visibility,
  unitsById,
  categoryMap,
  onToggleSelect,
  onOpenEdit,
  onDuplicate,
  onPriceChange,
}: CostItemRowProps) {
  const freshness = getPriceFreshness(item.updatedAt)

  return (
    <tr className="border-b align-top transition-colors hover:bg-slate-50">
      <td className="w-10 px-3 py-2">
        <Checkbox checked={selected} onCheckedChange={onToggleSelect} />
      </td>
      {visibility.identifier ? (
        <td
          className="px-3 py-2 font-code text-xs font-medium text-blue-700"
          title={
            item.isCustomItem
              ? `Belső kód: ${item.identifier} · Ajánlatban: ${getQuoteDisplayIdentifier(item)}`
              : undefined
          }
        >
          <div className="flex items-center gap-1">
            <HighlightText text={item.identifier} query={searchQuery} />
            {item.isCustomItem ? (
              <Badge variant="warning">
                K
              </Badge>
            ) : null}
          </div>
        </td>
      ) : null}
      {visibility.text ? (
        <td className="min-w-[16rem] max-w-2xl px-3 py-2 align-top">
          <button
            type="button"
            className="block w-full whitespace-normal break-words text-left text-sm leading-snug"
            onClick={onOpenEdit}
          >
            <span className="font-medium text-slate-900">
              <HighlightText text={item.text} query={searchQuery} />
            </span>
          </button>
        </td>
      ) : null}
      {visibility.category ? (
        <td className="hidden max-w-[10rem] px-3 py-2 text-slate-600 md:table-cell" title={categoryMap[item.categoryId]?.name}>
          <span className="font-code text-xs text-[var(--page-accent)]">
            {categoryMap[item.categoryId]?.code ?? "—"}
          </span>
        </td>
      ) : null}
      {visibility.trade ? (
        <td className="hidden px-3 py-2 text-slate-500 md:table-cell">
          {getTradeLabel(item.trade)}
        </td>
      ) : null}
      {visibility.unit ? (
        <td className="px-3 py-2 text-slate-600">{unitsById[item.unitId]?.code}</td>
      ) : null}
      {visibility.material ? (
        <td className="px-3 py-2 text-right">
          <InlinePriceCell
            value={item.materialUnitPrice}
            onCommit={(v) => onPriceChange("materialUnitPrice", v)}
          />
        </td>
      ) : null}
      {visibility.labor ? (
        <td className="px-3 py-2 text-right">
          <InlinePriceCell
            value={item.laborUnitPrice}
            onCommit={(v) => onPriceChange("laborUnitPrice", v)}
          />
        </td>
      ) : null}
      {visibility.total ? (
        <td className="px-3 py-2 text-right font-medium">{formatHuf(item.totalUnitPrice)}</td>
      ) : null}
      {visibility.status ? (
        <td className="px-3 py-2">
          <Badge variant={statusVariant[item.status]}>{statusLabels[item.status]}</Badge>
        </td>
      ) : null}
      {visibility.updated ? (
        <td className={`hidden px-3 py-2 text-xs lg:table-cell ${freshnessClass[freshness]}`}>
          {formatRelativeDate(item.updatedAt)}
        </td>
      ) : null}
      <td className="w-10 px-2 py-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-100"
              onClick={onOpenEdit}
            >
              <Pencil className="h-3.5 w-3.5" /> Szerkesztés
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-100"
              onClick={onDuplicate}
            >
              <Copy className="h-3.5 w-3.5" /> Duplikálás
            </button>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  )
}

export function getTradeGroups(items: CostItem[], groupByTrade: boolean) {
  if (!groupByTrade) return [{ trade: null as null, label: "Összes", items }]

  const order = getTradeOrder()
  const map = new Map<string, CostItem[]>()
  for (const item of items) {
    const list = map.get(item.trade) ?? []
    list.push(item)
    map.set(item.trade, list)
  }

  return order
    .filter((t) => map.has(t))
    .map((t) => ({
      trade: t,
      label: getTradeLabel(t),
      items: map.get(t)!,
    }))
}
