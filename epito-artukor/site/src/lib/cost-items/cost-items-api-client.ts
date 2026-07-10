import type { CostItem, CostItemInput, CostItemStatus } from "@/types"

export async function fetchCostItemsFromApi(): Promise<{
  items: CostItem[]
  error?: string
}> {
  const res = await fetch("/api/cost-items")
  const data = (await res.json()) as { items?: CostItem[]; error?: string }
  if (!res.ok) {
    return { items: [], error: data.error ?? "Nem sikerült betölteni a tételeket." }
  }
  return { items: data.items ?? [] }
}

export async function fetchCostItemsPageFromApi(params: {
  page: number
  pageSize?: number
  trade?: string
  categoryId?: string
  status?: string
  q?: string
}): Promise<{
  result: import("@/types").PaginatedResult<CostItem> | null
  error?: string
}> {
  const sp = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize ?? 50),
  })
  if (params.trade && params.trade !== "all") sp.set("trade", params.trade)
  if (params.categoryId && params.categoryId !== "all") sp.set("categoryId", params.categoryId)
  if (params.status && params.status !== "all") sp.set("status", params.status)
  if (params.q?.trim()) sp.set("q", params.q.trim())

  const res = await fetch(`/api/cost-items?${sp.toString()}`)
  const data = (await res.json()) as import("@/types").PaginatedResult<CostItem> & {
    error?: string
  }
  if (!res.ok) {
    return { result: null, error: data.error ?? "Nem sikerült betölteni a tételeket." }
  }
  return { result: data }
}

export async function saveCostItemToApi(
  input: CostItemInput,
  id?: string
): Promise<{ costItem?: CostItem; error?: string }> {
  const isUpdate = Boolean(id)
  const res = await fetch(isUpdate ? `/api/cost-items/${id}` : "/api/cost-items", {
    method: isUpdate ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const data = (await res.json()) as { costItem?: CostItem; error?: string }
  if (!res.ok) {
    return { error: data.error ?? "Mentés sikertelen." }
  }
  return { costItem: data.costItem }
}

export async function patchCostItemPricesToApi(
  id: string,
  patch: { materialUnitPrice?: number; laborUnitPrice?: number }
): Promise<{ costItem?: CostItem; error?: string }> {
  const res = await fetch("/api/cost-items/bulk", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...patch }),
  })
  const data = (await res.json()) as { costItem?: CostItem; error?: string }
  if (!res.ok) {
    return { error: data.error ?? "Ár frissítése sikertelen." }
  }
  return { costItem: data.costItem }
}

export async function bulkCostItemsAction(
  body:
    | { action: "status"; ids: string[]; status: CostItemStatus }
    | { action: "prices"; ids: string[]; percentChange: number; target: "material" | "labor" | "both" }
    | { action: "delete"; ids: string[] }
): Promise<{ items?: CostItem[]; error?: string }> {
  const res = await fetch("/api/cost-items/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = (await res.json()) as { items?: CostItem[]; error?: string; ok?: boolean }
  if (!res.ok) {
    return { error: data.error ?? "Tömeges művelet sikertelen." }
  }
  return { items: data.items }
}
