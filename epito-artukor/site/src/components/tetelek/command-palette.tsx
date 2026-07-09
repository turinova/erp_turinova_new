"use client"

import { useEffect, useState } from "react"
import type { CostItem } from "@/types"
import { getTradeLabel } from "@/lib/trades"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

type CommandPaletteProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: CostItem[]
  onSelectItem: (item: CostItem) => void
  onQuickAdd: () => void
  onFocusSearch: () => void
}

export function CommandPalette({
  open,
  onOpenChange,
  items,
  onSelectItem,
  onQuickAdd,
  onFocusSearch,
}: CommandPaletteProps) {
  const [q, setQ] = useState("")

  useEffect(() => {
    if (!open) setQ("")
  }, [open])

  const filtered = q.trim()
    ? items
        .filter((item) => {
          const hay = `${item.identifier} ${item.text} ${getTradeLabel(item.trade)}`.toLowerCase()
          return q
            .toLowerCase()
            .split(/\s+/)
            .every((t) => hay.includes(t))
        })
        .slice(0, 8)
    : items.slice(0, 6)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle className="sr-only">Parancspaletta</DialogTitle>
          <Input
            placeholder="Keresés tétel, parancs..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
            className="border-0 shadow-none focus-visible:ring-0"
          />
        </DialogHeader>
        <div className="max-h-80 overflow-y-auto p-2">
          {!q.trim() ? (
            <div className="mb-2 space-y-1">
              <button
                type="button"
                className="flex w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-100"
                onClick={() => {
                  onOpenChange(false)
                  onQuickAdd()
                }}
              >
                <span className="font-medium">+ Gyors K-tétel</span>
              </button>
              <button
                type="button"
                className="flex w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-100"
                onClick={() => {
                  onOpenChange(false)
                  onFocusSearch()
                }}
              >
                <span className="font-medium">/ Keresés fókusz</span>
              </button>
            </div>
          ) : null}
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              className="flex w-full flex-col rounded-md px-3 py-2 text-left hover:bg-slate-100"
              onClick={() => {
                onSelectItem(item)
                onOpenChange(false)
              }}
            >
              <span className="font-code text-xs text-blue-700">{item.identifier}</span>
              <span className="truncate text-sm">{item.shortLabel ?? item.text}</span>
              <span className="text-xs text-slate-500">{getTradeLabel(item.trade)}</span>
            </button>
          ))}
          {q.trim() && filtered.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-slate-500">Nincs találat</p>
          ) : null}
        </div>
        <div className="border-t px-4 py-2 text-xs text-slate-500">⌘K · Esc bezárás</div>
      </DialogContent>
    </Dialog>
  )
}
