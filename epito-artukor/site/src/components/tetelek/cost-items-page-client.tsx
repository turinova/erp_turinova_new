"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Archive,
  Percent,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Undo2,
  Zap,
} from "lucide-react"
import { toast } from "sonner"
import type { Category, CostItem, CostItemInput, CostItemStatus, Trade, Unit } from "@/types"
import type { AiSearchResult } from "@/lib/cost-items/ai-search-types"
import { getTradeLabel } from "@/lib/trades"
import { useTradeOptions } from "@/components/trades/trades-provider"
import { buildCategoryMap } from "@/lib/categories/category-tree"
import {
  bulkCostItemsAction,
  fetchCostItemsFromApi,
  patchCostItemPricesToApi,
  saveCostItemToApi,
} from "@/lib/cost-items/cost-items-api-client"
import { filterAllCostItems, loadCostItems, upsertCostItem } from "@/lib/data/cost-items-store"
import { loadCategories } from "@/lib/data/categories-store"
import { loadUnits } from "@/lib/data/units-store"
import { isMasterDataPrimed } from "@/lib/data/master-data-primer"
import { useAppData } from "@/components/shell/app-data-provider"
import { loadSavedViews, viewToFilters, type SavedView } from "@/lib/cost-item-views"
import { loadRecentItemIds, trackRecentItem } from "@/lib/cost-item-recent"
import { COLUMNS, type ColumnId } from "@/lib/column-config"
import { useUndoStack } from "@/hooks/use-undo-stack"
import { PageHeader } from "@/components/shell/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CostItemDrawer } from "@/components/tetelek/cost-item-drawer"
import { CostItemRow } from "@/components/tetelek/cost-item-row"
import { CostItemsAiSearchPanel } from "@/components/tetelek/cost-items-ai-search-panel"
import { CostItemsTradeSidebar } from "@/components/tetelek/cost-items-trade-sidebar"
import { ColumnToggle, useColumnVisibility } from "@/components/tetelek/column-toggle"
import { CommandPalette } from "@/components/tetelek/command-palette"
import { QuickKtetelDialog } from "@/components/tetelek/quick-ktetel-dialog"
import { BulkPriceDialog } from "@/components/tetelek/bulk-price-dialog"

const COLUMN_HEADERS: Record<ColumnId, string> = {
  identifier: "Tételszám",
  text: "Tétel szövege",
  category: "Kategória",
  trade: "Szakág",
  unit: "ME",
  material: "Anyag egységár",
  labor: "Díj egységre",
  total: "Összesen",
  status: "Státusz",
  updated: "Frissítve",
}

export function CostItemsPageClient() {
  const tradeOptions = useTradeOptions()
  const { ready: appReady } = useAppData()
  const { items, setItems, undo, canUndo, resetStack } = useUndoStack([])
  const [categories, setCategories] = useState<Category[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [activeTrade, setActiveTrade] = useState<Trade | "all">("all")
  const [categoryId, setCategoryId] = useState<string>("all")
  const [status, setStatus] = useState<CostItemStatus | "all">("all")
  const [customOnly, setCustomOnly] = useState(false)
  const [aiSearchLoading, setAiSearchLoading] = useState(false)
  const [aiSearchResult, setAiSearchResult] = useState<AiSearchResult | null>(null)
  const [quickInitial, setQuickInitial] = useState<{
    text?: string
    trade?: Trade
    categoryId?: string
  }>({})
  const [activeViewId, setActiveViewId] = useState<string | null>(null)
  const [savedViews] = useState<SavedView[]>(() => loadSavedViews())
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<CostItem | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [quickKtOpen, setQuickKtOpen] = useState(false)
  const [bulkPriceOpen, setBulkPriceOpen] = useState(false)
  const [recentIds, setRecentIds] = useState<string[]>([])
  const { visibility, setVisibility } = useColumnVisibility()

  const categoryMap = useMemo(() => buildCategoryMap(categories), [categories])
  const unitsById = useMemo(
    () => Object.fromEntries(units.map((u) => [u.id, u])),
    [units]
  )

  const refreshFromApi = useCallback(async () => {
    if (isMasterDataPrimed()) {
      resetStack(loadCostItems())
      setCategories(loadCategories())
      setUnits(loadUnits())
      return
    }

    const [itemsRes, categoriesRes, unitsRes] = await Promise.all([
      fetchCostItemsFromApi(),
      fetch("/api/categories").then((r) => r.json() as Promise<{ categories?: Category[] }>),
      fetch("/api/units").then((r) => r.json() as Promise<{ units?: Unit[] }>),
    ])

    if (itemsRes.error) {
      toast.error(itemsRes.error)
      resetStack([])
    } else {
      resetStack(itemsRes.items)
    }

    setCategories(categoriesRes.categories ?? [])
    setUnits(unitsRes.units ?? [])
  }, [resetStack])

  useEffect(() => {
    if (!appReady) return
    void refreshFromApi().finally(() => {
      setRecentIds(loadRecentItemIds())
      setDataLoading(false)
      setMounted(true)
    })
  }, [appReady, refreshFromApi])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 200)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    const q = debouncedSearch.trim()
    if (q.length < 3) {
      setAiSearchResult(null)
      setAiSearchLoading(false)
      return
    }

    let cancelled = false
    setAiSearchLoading(true)

    void (async () => {
      try {
        const res = await fetch("/api/cost-items/ai-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q }),
        })
        const data = (await res.json()) as AiSearchResult & { error?: string }
        if (!cancelled) {
          if (res.ok) setAiSearchResult(data)
          else setAiSearchResult(null)
        }
      } catch {
        if (!cancelled) setAiSearchResult(null)
      } finally {
        if (!cancelled) setAiSearchLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [debouncedSearch])

  const categoryItemCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of items) {
      if (!item.categoryId) continue
      counts.set(item.categoryId, (counts.get(item.categoryId) ?? 0) + 1)
    }
    return counts
  }, [items])

  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])

  const tradeCounts = useMemo(() => {
    const counts = new Map<Trade, number>()
    for (const t of tradeOptions) counts.set(t.id, 0)
    for (const item of items) {
      counts.set(item.trade, (counts.get(item.trade) ?? 0) + 1)
    }
    return counts
  }, [items, tradeOptions])

  const filteredItems = useMemo(() => {
    let list = filterAllCostItems(items, {
      q: debouncedSearch,
      trade: activeTrade === "all" ? undefined : activeTrade,
      categoryId: categoryId === "all" ? undefined : categoryId,
      status,
    })
    if (customOnly) list = list.filter((i) => i.isCustomItem)

    if (aiSearchResult?.matches.length && debouncedSearch.trim().length >= 3) {
      const rank = new Map(aiSearchResult.matches.map((m, i) => [m.itemId, i]))
      list = [...list].sort((a, b) => {
        const ra = rank.get(a.id) ?? 999
        const rb = rank.get(b.id) ?? 999
        return ra - rb
      })
    }

    return list
  }, [items, debouncedSearch, activeTrade, categoryId, status, customOnly, aiSearchResult])

  const recentItems = useMemo(
    () =>
      recentIds
        .map((id) => items.find((i) => i.id === id))
        .filter((i): i is CostItem => Boolean(i))
        .slice(0, 6),
    [recentIds, items]
  )

  const allVisibleSelected =
    filteredItems.length > 0 && filteredItems.every((item) => selectedIds.includes(item.id))

  const toggleAll = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filteredItems.some((item) => item.id === id)))
    } else {
      const ids = filteredItems.map((item) => item.id)
      setSelectedIds((prev) => [...new Set([...prev, ...ids])])
    }
  }

  const toggleOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const openNew = () => {
    setEditingItem(null)
    setDrawerOpen(true)
  }

  const openEdit = (item: CostItem) => {
    setEditingItem(item)
    setDrawerOpen(true)
    trackRecentItem(item.id)
    setRecentIds(loadRecentItemIds())
  }

  const saveItem = async (
    input: CostItemInput,
    options?: { close?: boolean; toast?: string }
  ) => {
    const id = input.id ?? editingItem?.id
    const { costItem, error } = await saveCostItemToApi({ ...input, id }, id)
    if (error) {
      toast.error(error)
      return
    }
    if (!costItem) return
    setItems((prev) => upsertCostItem(prev, costItem))
    trackRecentItem(costItem.id)
    setRecentIds(loadRecentItemIds())
    if (options?.close !== false) {
      setDrawerOpen(false)
      setEditingItem(null)
    } else {
      setEditingItem(costItem)
    }
    if (options?.toast) toast.success(options.toast)
  }

  const handleSave = (input: CostItemInput) => {
    saveItem(input, {
      close: true,
      toast: editingItem ? "Tétel mentve" : "Új tétel létrehozva",
    })
  }

  const handleAutosave = (input: CostItemInput) => {
    saveItem(input, { close: false })
  }

  const handleQuickSave = async (input: CostItemInput) => {
    const { costItem, error } = await saveCostItemToApi(input)
    if (error) {
      toast.error(error)
      return
    }
    if (!costItem) return
    setItems((prev) => upsertCostItem(prev, costItem))
    trackRecentItem(costItem.id)
    setRecentIds(loadRecentItemIds())
    toast.success("K-tétel létrehozva")
  }

  const handlePriceChange = async (
    id: string,
    field: "materialUnitPrice" | "laborUnitPrice",
    value: number
  ) => {
    const { costItem, error } = await patchCostItemPricesToApi(id, { [field]: value })
    if (error) {
      toast.error(error)
      return
    }
    if (!costItem) return
    setItems((prev) => upsertCostItem(prev, costItem))
    trackRecentItem(id)
    setRecentIds(loadRecentItemIds())
    toast.success("Ár frissítve", { duration: 1500 })
  }

  const handleDuplicate = async (id: string) => {
    const source = items.find((i) => i.id === id)
    if (!source) return

    const input: CostItemInput = {
      trade: source.trade,
      identifier: source.isCustomItem ? "" : `${source.identifier}-M`,
      isCustomItem: source.isCustomItem,
      text: `${source.text} (másolat)`,
      shortLabel: source.shortLabel ? `${source.shortLabel} (másolat)` : null,
      categoryId: source.categoryId,
      unitId: source.unitId,
      status: "draft",
      tags: source.tags,
      materialUnitPrice: source.materialUnitPrice,
      laborUnitPrice: source.laborUnitPrice,
    }
    const { costItem, error } = await saveCostItemToApi(input)
    if (error) {
      toast.error(error)
      return
    }
    if (!costItem) return
    setItems((prev) => [costItem, ...prev])
    toast.success("Tétel duplikálva (piszkozat)")
  }

  const handleArchiveSelected = async () => {
    if (!selectedIds.length) return
    const count = selectedIds.length

    const { error } = await bulkCostItemsAction({
      action: "status",
      ids: selectedIds,
      status: "archived",
    })
    if (error) {
      toast.error(error)
      return
    }
    await refreshFromApi()
    setSelectedIds([])
    toast.success(`${count} tétel archiválva`)
  }

  const handleBulkPrice = async (percent: number, target: "material" | "labor" | "both") => {
    const { error } = await bulkCostItemsAction({
      action: "prices",
      ids: selectedIds,
      percentChange: percent,
      target,
    })
    if (error) {
      toast.error(error)
      return
    }
    await refreshFromApi()
    toast.success(
      `${selectedIds.length} tétel ára módosítva (${percent > 0 ? "+" : ""}${percent}%)`
    )
  }

  const handleDeleteSelected = async () => {
    if (!selectedIds.length) return
    if (!confirm(`${selectedIds.length} tétel törlése?`)) return

    const { error } = await bulkCostItemsAction({
      action: "delete",
      ids: selectedIds,
    })
    if (error) {
      toast.error(error)
      return
    }
    await refreshFromApi()
    setSelectedIds([])
    toast.success("Tételek törölve")
  }

  const applyView = (view: SavedView) => {
    const filters = viewToFilters(view)
    if (filters.trade && filters.trade !== "all") {
      setActiveTrade(filters.trade)
    } else {
      setActiveTrade("all")
    }
    setCategoryId(filters.categoryId ?? "all")
    setStatus(filters.status ?? "all")
    setCustomOnly(view.id === "sv-k-tetel")
    setActiveViewId(view.id)
    setSearch("")
  }

  const clearView = () => {
    setActiveViewId(null)
    setCustomOnly(false)
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const inInput =
        e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement

      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setPaletteOpen(true)
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey && canUndo) {
        e.preventDefault()
        undo()
        toast.info("Visszavonva")
        return
      }

      if (inInput) {
        if (e.key === "/" && (e.target as HTMLElement).dataset?.search === "cost-items") {
          e.preventDefault()
        }
        return
      }

      if (e.key === "n" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        openNew()
      }
      if (e.key === "k" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        openQuickKt()
      }
      if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        document.querySelector<HTMLInputElement>('[data-search="cost-items"]')?.focus()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [canUndo, undo])

  const openSuggestedNewItem = () => {
    const suggestedCategoryId = aiSearchResult?.suggestedCategoryCode
      ? categories.find((c) => c.code === aiSearchResult.suggestedCategoryCode)?.id
      : undefined
    setQuickInitial({
      text: aiSearchResult?.suggestedText ?? debouncedSearch,
      trade: (aiSearchResult?.suggestedTradeCode as Trade | undefined) ?? undefined,
      categoryId: suggestedCategoryId,
    })
    setQuickKtOpen(true)
  }

  const openQuickKt = () => {
    setQuickInitial({})
    setQuickKtOpen(true)
  }

  const visibleColumns = COLUMNS.filter((c) => visibility[c.id])

  if (!mounted || dataLoading || !appReady) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 rounded bg-slate-200" />
        <div className="h-10 rounded bg-slate-200" />
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 rounded bg-slate-200" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title="Tételek"
        description={`${items.length} tétel · adatbázis`}
        actions={
          <>
            {canUndo ? (
              <Button variant="outline" size="sm" onClick={undo} title="⌘Z">
                <Undo2 className="h-4 w-4" />
                Visszavonás
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={openQuickKt}>
              <Zap className="h-4 w-4" />
              Gyors K-tétel
            </Button>
            <Button size="sm" onClick={openNew}>
              <Plus className="h-4 w-4" />
              Új tétel
            </Button>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap gap-2">
        {savedViews.map((view) => (
          <button
            key={view.id}
            type="button"
            onClick={() => applyView(view)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              activeViewId === view.id
                ? "border-blue-600 bg-blue-50 text-blue-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {view.name}
          </button>
        ))}
        {activeViewId ? (
          <button
            type="button"
            onClick={clearView}
            className="rounded-full px-2 py-1 text-xs text-slate-500 hover:text-slate-700"
          >
            Szűrő törlése
          </button>
        ) : null}
      </div>

      {!debouncedSearch && recentItems.length > 0 ? (
        <div className="mb-4 rounded-lg border bg-slate-50 px-4 py-3">
          <p className="ea-label mb-2 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Nemrég szerkesztve
          </p>
          <div className="flex flex-wrap gap-2">
            {recentItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openEdit(item)}
                className="max-w-md rounded-md border bg-white px-2.5 py-1.5 text-left text-sm hover:border-blue-300 hover:bg-blue-50"
              >
                <span className="font-code text-xs text-blue-700">{item.identifier}</span>
                <span className="mt-0.5 block whitespace-normal break-words text-slate-700">
                  {item.text}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <CostItemsTradeSidebar
          tradeOptions={tradeOptions}
          activeTrade={activeTrade}
          categoryId={categoryId}
          categories={categories}
          tradeItemCounts={tradeCounts}
          categoryItemCounts={categoryItemCounts}
          onTradeChange={(trade) => {
            setActiveTrade(trade)
            clearView()
          }}
          onCategoryChange={(id) => {
            setCategoryId(id)
            clearView()
          }}
        />

        <div className="min-w-0 flex-1">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                data-search="cost-items"
                placeholder="AI keresés: pl. fal glettelése Q2 minőségben… (/) · ⌘K"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  if (e.target.value) clearView()
                }}
                className="pl-9"
              />
            </div>
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v as CostItemStatus | "all")
                clearView()
              }}
            >
              <SelectTrigger className="w-full lg:w-40">
                <SelectValue placeholder="Státusz" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Minden státusz</SelectItem>
                <SelectItem value="active">Aktív</SelectItem>
                <SelectItem value="draft">Piszkozat</SelectItem>
                <SelectItem value="archived">Archivált</SelectItem>
              </SelectContent>
            </Select>
            <ColumnToggle visibility={visibility} onChange={setVisibility} />
          </div>

          <CostItemsAiSearchPanel
            query={debouncedSearch}
            loading={aiSearchLoading}
            result={aiSearchResult}
            itemsById={itemsById}
            onOpenItem={openEdit}
            onCreateSuggested={openSuggestedNewItem}
          />

          {selectedIds.length > 0 ? (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border bg-blue-50 px-4 py-2 text-sm">
              <span className="font-medium">{selectedIds.length} kijelölve</span>
              <Button variant="outline" size="sm" onClick={() => setBulkPriceOpen(true)}>
                <Percent className="h-4 w-4" />
                Áremelés %
              </Button>
              <Button variant="outline" size="sm" onClick={handleArchiveSelected}>
                <Archive className="h-4 w-4" />
                Archiválás
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDeleteSelected}>
                <Trash2 className="h-4 w-4" />
                Törlés
              </Button>
            </div>
          ) : null}

          <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="ea-table-head">
                  <tr>
                    <th className="w-10 px-3 py-3">
                      <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAll} />
                    </th>
                    {visibleColumns.map((col) => (
                      <th
                        key={col.id}
                        className={`px-3 py-3 ${
                          col.id === "material" || col.id === "labor" || col.id === "total"
                            ? "text-right"
                            : ""
                        } ${col.id === "trade" || col.id === "category" || col.id === "updated" ? "hidden md:table-cell" : ""} ${
                          col.id === "material" || col.id === "labor" ? "hidden lg:table-cell" : ""
                        } ${col.id === "updated" ? "lg:table-cell" : ""}`}
                      >
                        {COLUMN_HEADERS[col.id]}
                      </th>
                    ))}
                    <th className="w-10 px-3 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => (
                    <CostItemRow
                      key={item.id}
                      item={item}
                      searchQuery={debouncedSearch}
                      selected={selectedIds.includes(item.id)}
                      visibility={visibility}
                      unitsById={unitsById}
                      categoryMap={categoryMap}
                      onToggleSelect={() => toggleOne(item.id)}
                      onOpenEdit={() => openEdit(item)}
                      onDuplicate={() => handleDuplicate(item.id)}
                      onPriceChange={(field, value) => handlePriceChange(item.id, field, value)}
                    />
                  ))}
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={visibleColumns.length + 2}
                        className="px-3 py-12 text-center text-slate-500"
                      >
                        {debouncedSearch.trim()
                          ? "Nincs találat — az AI javaslatot fentebb mutatja, ha van."
                          : activeTrade === "all"
                            ? "Nincs tétel a szűrők alapján."
                            : `Nincs tétel: ${getTradeLabel(activeTrade)}`}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 text-sm text-slate-500">
            {filteredItems.length} tétel
            {activeTrade !== "all" ? ` · ${getTradeLabel(activeTrade)}` : ""}
            {categoryId !== "all" && categoryMap[categoryId]
              ? ` · ${categoryMap[categoryId].code}`
              : ""}
            {" · "}
            <span className="text-xs">K = gyors K-tétel · ⌘K = parancsok · ⌘Z = visszavonás</span>
          </div>
        </div>
      </div>

      <CostItemDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        item={editingItem}
        allItems={items}
        categories={categories}
        units={units}
        onSave={handleSave}
        onAutosave={handleAutosave}
        onOpenExisting={openEdit}
      />

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        items={items}
        onSelectItem={openEdit}
        onQuickAdd={openQuickKt}
        onFocusSearch={() =>
          document.querySelector<HTMLInputElement>('[data-search="cost-items"]')?.focus()
        }
      />

      <QuickKtetelDialog
        open={quickKtOpen}
        onOpenChange={setQuickKtOpen}
        defaultTrade={activeTrade === "all" ? (tradeOptions[0]?.id ?? "epitomester") : activeTrade}
        initialText={quickInitial.text}
        initialTrade={quickInitial.trade}
        initialCategoryId={quickInitial.categoryId}
        existingItems={items}
        categories={categories}
        units={units}
        onSave={handleQuickSave}
      />

      <BulkPriceDialog
        open={bulkPriceOpen}
        onOpenChange={setBulkPriceOpen}
        count={selectedIds.length}
        onApply={handleBulkPrice}
      />
    </>
  )
}
