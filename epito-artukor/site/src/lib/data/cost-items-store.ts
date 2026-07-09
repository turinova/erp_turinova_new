import type { CostItem, CostItemFilters, PaginatedResult } from "@/types"
import { matchesFuzzySearch } from "@/lib/cost-item-search"

/** In-memory cache — a DB (/api/cost-items) az egyetlen forrás, a primer tölti fel. */
let costItemsCache: CostItem[] = []

export function setCostItemsCache(items: CostItem[]): void {
  costItemsCache = items
}

export function loadCostItems(): CostItem[] {
  return costItemsCache
}

export function saveCostItems(items: CostItem[]): void {
  costItemsCache = items
}

export function applyFilters(items: CostItem[], filters: CostItemFilters): CostItem[] {
  let filtered = [...items]

  if (filters.q) {
    filtered = filtered.filter((item) => matchesFuzzySearch(item, filters.q!))
  }

  if (filters.trade && filters.trade !== "all") {
    filtered = filtered.filter((item) => item.trade === filters.trade)
  }

  if (filters.categoryId) {
    filtered = filtered.filter((item) => item.categoryId === filters.categoryId)
  }

  if (filters.status && filters.status !== "all") {
    filtered = filtered.filter((item) => item.status === filters.status)
  }

  return filtered.sort((a, b) => a.identifier.localeCompare(b.identifier, "hu"))
}

export function filterAllCostItems(items: CostItem[], filters: CostItemFilters): CostItem[] {
  return applyFilters(items, filters)
}

export function filterCostItems(
  items: CostItem[],
  filters: CostItemFilters
): PaginatedResult<CostItem> {
  const filtered = applyFilters(items, filters)

  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 50
  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const start = (page - 1) * pageSize

  return {
    items: filtered.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    totalPages,
  }
}

export function upsertCostItem(items: CostItem[], item: CostItem): CostItem[] {
  const index = items.findIndex((i) => i.id === item.id)
  if (index === -1) return [item, ...items]
  const next = [...items]
  next[index] = item
  return next
}
