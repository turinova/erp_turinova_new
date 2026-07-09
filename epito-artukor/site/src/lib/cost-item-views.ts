import type { CostItemFilters, CostItemStatus, Trade } from "@/types"

export type SavedView = {
  id: string
  name: string
  trade: Trade | "all"
  categoryId: string
  status: CostItemStatus | "all"
}

const STORAGE_KEY = "epito-artukor:saved-views"

export const DEFAULT_SAVED_VIEWS: SavedView[] = [
  { id: "sv-k-tetel", name: "K-tételek", trade: "all", categoryId: "all", status: "active" },
  { id: "sv-epito", name: "Építőmester", trade: "epitomester", categoryId: "all", status: "active" },
  { id: "sv-gep", name: "Gépészet", trade: "gepeszet", categoryId: "all", status: "active" },
  { id: "sv-draft", name: "Piszkozatok", trade: "all", categoryId: "all", status: "draft" },
]

export function loadSavedViews(): SavedView[] {
  if (typeof window === "undefined") return DEFAULT_SAVED_VIEWS
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return DEFAULT_SAVED_VIEWS
    return JSON.parse(stored) as SavedView[]
  } catch {
    return DEFAULT_SAVED_VIEWS
  }
}

export function saveSavedViews(views: SavedView[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(views))
}

export function viewToFilters(view: SavedView): Pick<CostItemFilters, "trade" | "categoryId" | "status"> {
  return {
    trade: view.trade,
    categoryId: view.categoryId === "all" ? undefined : view.categoryId,
    status: view.status,
  }
}
