"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import type { Category, Trade } from "@/types"
import { getCategoryPath } from "@/lib/categories/category-tree"
import { getTradeLabel } from "@/lib/trades"
import { useTradeOptions } from "@/components/trades/trades-provider"
import { setCategoriesCache } from "@/lib/data/categories-store"
import type { CategoryWriteInput } from "@/lib/categories/category-map"
import { validateCategoryInput } from "@/lib/categories/validate-category"
import { PageHeader } from "@/components/shell/page-header"
import { Button } from "@/components/ui/button"
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
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [form, setForm] = useState({
    code: "",
    name: "",
    parentId: "none",
    trade: "epitomester" as Trade,
  })

  const fetchCategoriesFromApi = useCallback(async () => {
    try {
      const res = await fetch("/api/categories")
      const data = (await res.json()) as { categories?: Category[]; error?: string }
      if (!res.ok) {
        toast.error(data.error ?? "Nem sikerült betölteni a kategóriákat.")
        setCategories([])
        return
      }
      setCategories(data.categories ?? [])
      setCategoriesCache(data.categories ?? [])
    } catch {
      toast.error("Hálózati hiba — próbáld újra.")
      setCategories([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchCategoriesFromApi()
  }, [fetchCategoriesFromApi])

  const openNew = () => {
    setEditing(null)
    setForm({ code: "", name: "", parentId: "none", trade: "epitomester" })
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
    if (!confirm("Kategória törlése? Az al-kategóriák is törlődnek.")) return

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

  const sorted = useMemo(
    () => [...categories].sort((a, b) => a.sortOrder - b.sortOrder),
    [categories]
  )

  const parentOptions = useMemo(
    () =>
      categories.filter((c) => c.id !== editing?.id && c.trade === form.trade),
    [categories, editing?.id, form.trade]
  )

  if (loading) {
    return <div className="h-64 animate-pulse rounded-lg bg-[var(--muted)]" />
  }

  return (
    <>
      <PageHeader
        title="Kategóriák"
        description={`${categories.length} kategória · fa struktúra`}
        actions={
          <Button size="sm" onClick={openNew} disabled={saving}>
            <Plus className="h-4 w-4" />
            Új kategória
          </Button>
        }
      />

      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="ea-table-head">
              <tr>
                <th className="px-4 py-3 text-left">Kód</th>
                <th className="px-4 py-3 text-left">Név</th>
                <th className="px-4 py-3 text-left">Szakág</th>
                <th className="px-4 py-3 text-left">Útvonal</th>
                <th className="w-28 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-[var(--muted-foreground)]">
                    Még nincs kategória. Hozz létre egyet a fenti gombbal.
                  </td>
                </tr>
              ) : (
                sorted.map((cat) => (
                  <tr key={cat.id} className="border-b last:border-b-0 hover:bg-[var(--muted)]/40">
                    <td className="px-4 py-3 font-code text-xs font-medium text-[var(--brand)]">
                      {cat.code}
                    </td>
                    <td className="px-4 py-3 font-medium">{cat.name}</td>
                    <td className="px-4 py-3 text-[var(--muted-foreground)]">
                      {getTradeLabel(cat.trade)}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted-foreground)]">
                      {getCategoryPath(cat.id, categories)}
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
                          className="text-red-600 hover:text-red-700"
                          onClick={() => void handleDelete(cat.id)}
                          disabled={saving}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
