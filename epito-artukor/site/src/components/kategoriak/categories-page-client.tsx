"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Pencil, Plus, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"
import type { Category, CostItem, Trade } from "@/types"
import { getCategoryPath } from "@/lib/categories/category-tree"
import { getTradeLabel } from "@/lib/trades"
import { useTradeOptions } from "@/components/trades/trades-provider"
import { setCategoriesCache, loadCategories } from "@/lib/data/categories-store"
import { loadCostItems } from "@/lib/data/cost-items-store"
import { isMasterDataPrimed } from "@/lib/data/master-data-primer"
import { useAppData } from "@/components/shell/app-data-provider"
import type { CategoryWriteInput } from "@/lib/categories/category-map"
import { validateCategoryInput } from "@/lib/categories/validate-category"
import { cn } from "@/lib/utils"
import { PageHeader } from "@/components/shell/page-header"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

export function CategoriesPageClient() {
  const tradeOptions = useTradeOptions()
  const { ready: appReady } = useAppData()
  const [categories, setCategories] = useState<Category[]>([])
  const [itemCounts, setItemCounts] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [selectedTrade, setSelectedTrade] = useState<string>("all")
  const [search, setSearch] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [form, setForm] = useState({
    code: "",
    name: "",
    parentId: "none",
    trade: "epitomester" as Trade,
  })

  const fetchCategoriesFromApi = useCallback(async () => {
    try {
      if (isMasterDataPrimed()) {
        const cachedCategories = loadCategories()
        const counts = new Map<string, number>()
        for (const item of loadCostItems()) {
          if (!item.categoryId) continue
          counts.set(item.categoryId, (counts.get(item.categoryId) ?? 0) + 1)
        }
        setCategories(cachedCategories)
        setItemCounts(counts)
        return
      }

      const [catRes, itemsRes] = await Promise.all([
        fetch("/api/categories"),
        fetch("/api/cost-items"),
      ])
      const catData = (await catRes.json()) as { categories?: Category[]; error?: string }
      if (!catRes.ok) {
        toast.error(catData.error ?? "Nem sikerült betölteni a kategóriákat.")
        setCategories([])
        return
      }
      setCategories(catData.categories ?? [])
      setCategoriesCache(catData.categories ?? [])

      if (itemsRes.ok) {
        const itemsData = (await itemsRes.json()) as { items?: CostItem[] }
        const counts = new Map<string, number>()
        for (const item of itemsData.items ?? []) {
          if (!item.categoryId) continue
          counts.set(item.categoryId, (counts.get(item.categoryId) ?? 0) + 1)
        }
        setItemCounts(counts)
      }
    } catch {
      toast.error("Hálózati hiba — próbáld újra.")
      setCategories([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!appReady) return
    void fetchCategoriesFromApi()
  }, [appReady, fetchCategoriesFromApi])

  /** Szakág-kód → pozíció az építési sorrendben (a trades sort_order szerint) */
  const tradeRank = useMemo(() => {
    const rank = new Map<string, number>()
    tradeOptions.forEach((t, i) => rank.set(t.id, i))
    return rank
  }, [tradeOptions])

  const countByTrade = useMemo(() => {
    const counts = new Map<string, number>()
    for (const cat of categories) {
      counts.set(cat.trade, (counts.get(cat.trade) ?? 0) + 1)
    }
    return counts
  }, [categories])

  const normalizedSearch = search.trim().toLowerCase()

  const visible = useMemo(() => {
    let list = [...categories]
    if (normalizedSearch) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(normalizedSearch) ||
          c.code.toLowerCase().includes(normalizedSearch)
      )
    } else if (selectedTrade !== "all") {
      list = list.filter((c) => c.trade === selectedTrade)
    }
    return list.sort((a, b) => {
      const tr = (tradeRank.get(a.trade) ?? 999) - (tradeRank.get(b.trade) ?? 999)
      if (tr !== 0) return tr
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
      return a.name.localeCompare(b.name, "hu")
    })
  }, [categories, normalizedSearch, selectedTrade, tradeRank])

  const searchActive = normalizedSearch.length > 0

  const openNew = () => {
    setEditing(null)
    setForm({
      code: "",
      name: "",
      parentId: "none",
      trade: (selectedTrade !== "all" ? selectedTrade : tradeOptions[0]?.id ?? "epitomester") as Trade,
    })
    setDrawerOpen(true)
  }

  const openEdit = (cat: Category) => {
    setEditing(cat)
    setForm({
      code: cat.code,
      name: cat.name,
      parentId: cat.parentId ?? "none",
      trade: cat.trade,
    })
    setDrawerOpen(true)
  }

  const buildPayload = (): CategoryWriteInput => ({
    trade: form.trade,
    code: form.code,
    name: form.name,
    parentId: form.parentId === "none" ? null : form.parentId,
  })

  const handleSave = async () => {
    const payload = buildPayload()
    const validation = validateCategoryInput(payload, categories, editing?.id, tradeOptions.map((t) => t.id))
    if (!validation.ok) {
      toast.error(validation.error)
      return
    }

    setSaving(true)
    try {
      const res = await fetch(editing ? `/api/categories/${editing.id}` : "/api/categories", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = (await res.json()) as { category?: Category; error?: string }
      if (!res.ok) {
        toast.error(data.error ?? "Mentés sikertelen.")
        return
      }
      setDrawerOpen(false)
      toast.success(editing ? "Kategória mentve" : "Új kategória létrehozva")
      await fetchCategoriesFromApi()
    } catch {
      toast.error("Hálózati hiba — próbáld újra.")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/categories/${id}`, { method: "DELETE" })
      const data = (await res.json()) as { error?: string; deletedCount?: number }
      if (!res.ok) {
        toast.error(data.error ?? "Törlés sikertelen.")
        return
      }
      toast.success("Kategória törölve")
      await fetchCategoriesFromApi()
    } catch {
      toast.error("Hálózati hiba — próbáld újra.")
    } finally {
      setSaving(false)
    }
  }

  const parentOptions = useMemo(
    () =>
      categories.filter((c) => c.id !== editing?.id && c.trade === form.trade),
    [categories, editing?.id, form.trade]
  )

  const selectedTradeLabel =
    selectedTrade === "all" ? null : tradeOptions.find((t) => t.id === selectedTrade)?.label

  if (loading || !appReady) {
    return <div className="h-64 animate-pulse rounded-lg bg-[var(--muted)]" />
  }

  return (
    <>
      <PageHeader
        title="Kategóriák"
        description={`${categories.length} kategória · ${tradeOptions.length} szakág`}
        actions={
          <Button size="sm" onClick={openNew} disabled={saving}>
            <Plus className="h-4 w-4" />
            Új kategória
          </Button>
        }
      />

      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        {/* Bal panel — szakág-lista */}
        <aside className="w-full shrink-0 md:w-64">
          <div className="rounded-lg border bg-white shadow-sm">
            <div className="border-b p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Keresés névre, kódra…"
                  className="h-8 pl-8 text-sm"
                />
              </div>
            </div>
            <nav className="max-h-[28rem] overflow-y-auto p-1.5 md:max-h-[calc(100vh-20rem)]">
              <button
                type="button"
                onClick={() => {
                  setSelectedTrade("all")
                  setSearch("")
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-sm transition-colors",
                  selectedTrade === "all" && !searchActive
                    ? "bg-[var(--page-accent-muted)] font-medium text-[var(--page-accent)]"
                    : "text-[var(--foreground)] hover:bg-[var(--muted)]"
                )}
              >
                <span>Összes szakág</span>
                <span className="font-code text-xs text-[var(--muted-foreground)]">
                  {categories.length}
                </span>
              </button>
              {tradeOptions.map((t) => {
                const count = countByTrade.get(t.id) ?? 0
                const active = selectedTrade === t.id && !searchActive
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setSelectedTrade(t.id)
                      setSearch("")
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
          </div>
        </aside>

        {/* Jobb panel — kategória-tábla */}
        <div className="min-w-0 flex-1 overflow-hidden rounded-lg border bg-white shadow-sm">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <div className="text-sm font-medium">
              {searchActive
                ? `Találatok: „${search.trim()}"`
                : selectedTradeLabel ?? "Összes szakág"}
              <span className="ml-2 text-xs font-normal text-[var(--muted-foreground)]">
                {visible.length} kategória
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="ea-table-head">
                <tr>
                  <th className="px-4 py-3 text-left">Kód</th>
                  <th className="px-4 py-3 text-left">Név</th>
                  {(searchActive || selectedTrade === "all") ? (
                    <th className="px-4 py-3 text-left">Szakág</th>
                  ) : null}
                  <th className="px-4 py-3 text-right">Tételek</th>
                  <th className="w-28 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-[var(--muted-foreground)]">
                      {searchActive
                        ? "Nincs találat a keresésre."
                        : selectedTrade !== "all"
                          ? "Ehhez a szakághoz még nincs kategória — hozz létre egyet a fenti gombbal."
                          : "Még nincs kategória. Hozz létre egyet a fenti gombbal."}
                    </td>
                  </tr>
                ) : (
                  visible.map((cat) => {
                    const itemCount = itemCounts.get(cat.id) ?? 0
                    return (
                      <tr key={cat.id} className="border-b last:border-b-0 hover:bg-[var(--muted)]/40">
                        <td className="px-4 py-3 font-code text-xs font-medium text-[var(--page-accent)]">
                          {cat.code}
                        </td>
                        <td className="px-4 py-3 font-medium">{cat.name}</td>
                        {(searchActive || selectedTrade === "all") ? (
                          <td className="px-4 py-3 text-[var(--muted-foreground)]">
                            {getTradeLabel(cat.trade)}
                          </td>
                        ) : null}
                        <td className="px-4 py-3 text-right">
                          {itemCount > 0 ? (
                            <span className="font-code text-xs font-medium">{itemCount}</span>
                          ) : (
                            <span className="font-code text-xs text-[var(--muted-foreground)]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(cat)}
                              disabled={saving}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Szerk.
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={cn(
                                itemCount > 0
                                  ? "text-[var(--muted-foreground)]"
                                  : "text-red-600 hover:text-red-700"
                              )}
                              title={
                                itemCount > 0
                                  ? `Nem törölhető — ${itemCount} tétel használja`
                                  : "Törlés"
                              }
                              onClick={() => {
                                if (itemCount > 0) {
                                  toast.error(
                                    `Nem törölhető — ${itemCount} tétel használja ezt a kategóriát.`
                                  )
                                  return
                                }
                                setDeleteTarget(cat)
                              }}
                              disabled={saving}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title="Kategória törlése"
        description={
          deleteTarget ? (
            <p>
              Biztosan törlöd a(z){" "}
              <span className="font-medium text-slate-900">{deleteTarget.name}</span> kategóriát (
              <span className="font-code">{deleteTarget.code}</span>)? Az al-kategóriák is
              törlődnek.
            </p>
          ) : null
        }
        confirmLabel="Törlés"
        destructive
        onConfirm={() => {
          if (deleteTarget) void handleDelete(deleteTarget.id)
        }}
      />

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editing ? "Kategória szerkesztése" : "Új kategória"}</SheetTitle>
          </SheetHeader>
          <SheetBody className="space-y-4">
            <div className="space-y-2">
              <Label>Szakág</Label>
              <Select
                value={form.trade}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, trade: v as Trade, parentId: "none" }))
                }
                disabled={Boolean(editing)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tradeOptions.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-code">Kód</Label>
              <Input
                id="cat-code"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                className="font-code uppercase"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-name">Név</Label>
              <Input
                id="cat-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Szülő kategória</Label>
              <Select
                value={form.parentId}
                onValueChange={(v) => setForm((f) => ({ ...f, parentId: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Gyökér kategória —</SelectItem>
                  {parentOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {getCategoryPath(c.id, categories)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </SheetBody>
          <SheetFooter>
            <Button variant="outline" onClick={() => setDrawerOpen(false)} disabled={saving}>
              Mégse
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Mentés…" : "Mentés"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
