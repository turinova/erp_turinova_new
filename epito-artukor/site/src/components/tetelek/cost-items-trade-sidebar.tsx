"use client"

import { useMemo } from "react"
import type { Category, Trade } from "@/types"
import { cn } from "@/lib/utils"

type TradeOption = { id: Trade; label: string }

type CostItemsTradeSidebarProps = {
  tradeOptions: TradeOption[]
  activeTrade: Trade | "all"
  categoryId: string
  categories: Category[]
  tradeItemCounts: Map<Trade, number>
  categoryItemCounts: Map<string, number>
  onTradeChange: (trade: Trade | "all") => void
  onCategoryChange: (categoryId: string) => void
}

export function CostItemsTradeSidebar({
  tradeOptions,
  activeTrade,
  categoryId,
  categories,
  tradeItemCounts,
  categoryItemCounts,
  onTradeChange,
  onCategoryChange,
}: CostItemsTradeSidebarProps) {
  const totalCount = useMemo(() => {
    let sum = 0
    for (const n of tradeItemCounts.values()) sum += n
    return sum
  }, [tradeItemCounts])

  const categoriesForTrade = useMemo(() => {
    if (activeTrade === "all") return []
    return categories
      .filter((c) => c.trade === activeTrade)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }, [categories, activeTrade])

  return (
    <aside className="w-full shrink-0 md:w-64">
      <div className="rounded-lg border bg-white shadow-sm">
        <nav className="max-h-[20rem] overflow-y-auto p-1.5 md:max-h-[calc(100vh-18rem)]">
          <button
            type="button"
            onClick={() => {
              onTradeChange("all")
              onCategoryChange("all")
            }}
            className={cn(
              "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-sm transition-colors",
              activeTrade === "all"
                ? "bg-[var(--page-accent-muted)] font-medium text-[var(--page-accent)]"
                : "text-[var(--foreground)] hover:bg-[var(--muted)]"
            )}
          >
            <span>Összes szakág</span>
            <span className="font-code text-xs text-[var(--muted-foreground)]">{totalCount}</span>
          </button>

          {tradeOptions.map((t) => {
            const count = tradeItemCounts.get(t.id) ?? 0
            const active = activeTrade === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  onTradeChange(t.id)
                  onCategoryChange("all")
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
                  active
                    ? "bg-[var(--page-accent-muted)] font-medium text-[var(--page-accent)]"
                    : count === 0
                      ? "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                      : "text-[var(--foreground)] hover:bg-[var(--muted)]"
                )}
              >
                <span className="truncate">{t.label}</span>
                <span className="font-code text-xs text-[var(--muted-foreground)]">{count}</span>
              </button>
            )
          })}
        </nav>

        {activeTrade !== "all" && categoriesForTrade.length > 0 ? (
          <div className="border-t p-1.5">
            <p className="px-2.5 py-1 text-xs font-medium text-[var(--muted-foreground)]">
              Kategóriák
            </p>
            <button
              type="button"
              onClick={() => onCategoryChange("all")}
              className={cn(
                "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-sm transition-colors",
                categoryId === "all"
                  ? "bg-[var(--page-accent-muted)] font-medium text-[var(--page-accent)]"
                  : "hover:bg-[var(--muted)]"
              )}
            >
              <span>Minden kategória</span>
            </button>
            {categoriesForTrade.map((cat) => {
              const count = categoryItemCounts.get(cat.id) ?? 0
              const active = categoryId === cat.id
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => onCategoryChange(cat.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors",
                    active
                      ? "bg-[var(--page-accent-muted)] font-medium text-[var(--page-accent)]"
                      : count === 0
                        ? "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                        : "hover:bg-[var(--muted)]"
                  )}
                >
                  <span className="line-clamp-2">
                    <span className="font-code">{cat.code}</span> — {cat.name}
                  </span>
                  {count > 0 ? (
                    <span className="shrink-0 font-code text-[var(--muted-foreground)]">
                      {count}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        ) : null}
      </div>
    </aside>
  )
}
