"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Sparkles } from "lucide-react"
import type { Category, CostItem, CostItemInput, CostItemStatus, Trade, Unit } from "@/types"
import { getCategoriesForTradeSelect, getDefaultCategoryForTrade } from "@/lib/categories/category-tree"
import { cn } from "@/lib/utils"
import { useItemTextPolish } from "@/hooks/use-item-text-polish"
import {
  ItemTextPolishPanel,
  polishedTextareaClass,
} from "@/components/tetelek/item-text-polish-panel"
import { calculateTotalUnitPrice, deriveShortLabel, formatHuf } from "@/lib/pricing"
import { useTradeOptions } from "@/components/trades/trades-provider"
import { getSimilarItems } from "@/lib/cost-item-search"
import { previewNextCustomIdentifier } from "@/lib/item-identifier"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
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
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { SimilarItemsAlert } from "@/components/tetelek/similar-items-alert"

type CostItemDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: CostItem | null
  allItems: CostItem[]
  categories: Category[]
  units: Unit[]
  onSave: (input: CostItemInput) => void
  onAutosave: (input: CostItemInput) => void
  onOpenExisting: (item: CostItem) => void
}

const emptyForm = (
  categories: Category[],
  units: Unit[],
  defaultTrade: Trade = "epitomester"
): CostItemInput => ({
  trade: defaultTrade,
  identifier: "",
  isCustomItem: true,
  text: "",
  shortLabel: null,
  categoryId: getDefaultCategoryForTrade(defaultTrade, categories) || categories[0]?.id || "",
  unitId: units.find((u) => u.code === "m2")?.id ?? units[0]?.id ?? "",
  status: "active",
  tags: [],
  materialUnitPrice: 0,
  laborUnitPrice: 0,
})

const AUTOSAVE_MS = 800

export function CostItemDrawer({
  open,
  onOpenChange,
  item,
  allItems,
  categories,
  units,
  onSave,
  onAutosave,
  onOpenExisting,
}: CostItemDrawerProps) {
  const tradeOptions = useTradeOptions()
  const categoryMap = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])),
    [categories]
  )
  const [form, setForm] = useState<CostItemInput>(() =>
    emptyForm(categories, units, tradeOptions[0]?.id ?? "epitomester")
  )
  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "pending" | "saved">("idle")
  const [forceSave, setForceSave] = useState(false)
  const [dismissedSimilar, setDismissedSimilar] = useState(false)
  const isNew = !item
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = useRef<string>("")
  const textRef = useRef<HTMLTextAreaElement>(null)

  const { polishResult, polishLoading, polishText, clearPolish } = useItemTextPolish()

  const handleTextBlur = async () => {
    if (!form.text.trim()) return
    const result = await polishText(form.text, {
      trade: form.trade,
      categoryId: form.categoryId,
      referenceItems: allItems,
    })
    if (result.changed) {
      setForm((f) => ({ ...f, text: result.polished }))
    }
  }

  const handleTextChange = (value: string) => {
    clearPolish()
    setForm((f) => ({ ...f, text: value }))
  }

  const handleRevertPolish = () => {
    if (!polishResult) return
    setForm((f) => ({ ...f, text: polishResult.original }))
    clearPolish()
  }

  const categoriesForTrade = getCategoriesForTradeSelect(form.trade, categories)

  useEffect(() => {
    if (item) {
      const next = {
        id: item.id,
        trade: item.trade,
        identifier: item.identifier,
        isCustomItem: item.isCustomItem,
        text: item.text,
        shortLabel: item.shortLabel,
        categoryId: item.categoryId,
        unitId: item.unitId,
        status: item.status,
        tags: item.tags,
        materialUnitPrice: item.materialUnitPrice,
        laborUnitPrice: item.laborUnitPrice,
      }
      setForm(next)
      lastSavedRef.current = JSON.stringify(next)
    } else {
      setForm(emptyForm(categories, units, tradeOptions[0]?.id ?? "epitomester"))
      lastSavedRef.current = ""
    }
    setAutosaveStatus("idle")
    setForceSave(false)
    setDismissedSimilar(false)
    clearPolish()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clearPolish stabil
  }, [item, open])

  useEffect(() => {
    if (open && isNew) {
      const t = setTimeout(() => textRef.current?.focus(), 100)
      return () => clearTimeout(t)
    }
  }, [open, isNew])

  const isCustomMode = form.isCustomItem ?? true
  const previewIdentifier = useMemo(() => {
    if (!isNew || !isCustomMode) return null
    return previewNextCustomIdentifier(allItems, form.categoryId, categoryMap)
  }, [isNew, isCustomMode, allItems, form.categoryId, categoryMap])

  const canSave = Boolean(form.text.trim() && (isCustomMode || form.identifier.trim()))

  const total = calculateTotalUnitPrice({
    materialUnitPrice: form.materialUnitPrice,
    laborUnitPrice: form.laborUnitPrice,
  })

  const buildPayload = useCallback(
    (): CostItemInput => ({
      ...form,
      isCustomItem: isCustomMode,
      shortLabel: form.shortLabel?.trim() || deriveShortLabel(form.text),
    }),
    [form, isCustomMode]
  )

  const similar = useMemo(() => {
    if (!form.text.trim() || dismissedSimilar) return []
    const candidate = {
      id: form.id ?? "new",
      identifier: form.identifier,
      text: form.text,
    } as CostItem
    return getSimilarItems(allItems, candidate)
  }, [allItems, form.id, form.identifier, form.text, dismissedSimilar])

  const commitSave = useCallback(
    (mode: "manual" | "auto" = "manual") => {
      if (!canSave) return
      const payload = buildPayload()
      if (mode === "auto") {
        onAutosave(payload)
      } else {
        onSave(payload)
      }
      lastSavedRef.current = JSON.stringify({ ...form, ...payload })
      setAutosaveStatus("saved")
    },
    [buildPayload, form, onSave, onAutosave, canSave]
  )

  // Autosave for existing items
  useEffect(() => {
    if (!open || isNew) return
    const snapshot = JSON.stringify(form)
    if (snapshot === lastSavedRef.current) return
    if (!canSave) return

    setAutosaveStatus("pending")
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      commitSave("auto")
    }, AUTOSAVE_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [open, isNew, form, commitSave, canSave])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSave) return
    if (isNew && similar.length > 0 && !forceSave) {
      return
    }
    commitSave("manual")
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s" && open) {
        e.preventDefault()
        if (canSave) {
          if (isNew && similar.length > 0 && !forceSave) {
            setForceSave(true)
          } else {
            commitSave("manual")
          }
        }
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, form, commitSave, isNew, similar.length, forceSave, canSave])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl">
        <form onSubmit={handleSubmit} className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle>{item ? "Tétel szerkesztése" : "Új tétel"}</SheetTitle>
            <SheetDescription className="flex items-center gap-2">
              {item ? item.identifier : "Új költségvetési tétel hozzáadása"}
              {!isNew && autosaveStatus === "pending" ? (
                <span className="text-xs text-amber-600">Mentés...</span>
              ) : null}
              {!isNew && autosaveStatus === "saved" ? (
                <span className="text-xs text-emerald-600">Mentve</span>
              ) : null}
            </SheetDescription>
          </SheetHeader>

          <SheetBody className="space-y-6">
            {isNew && similar.length > 0 && !forceSave ? (
              <SimilarItemsAlert
                similar={similar}
                onOpenExisting={(existing) => {
                  onOpenChange(false)
                  onOpenExisting(existing)
                }}
                onContinue={() => setForceSave(true)}
              />
            ) : null}

            {/* 1. Azonosítás — típus, szekció, tételszám egy helyen */}
            <section className="space-y-3">
              <h3 className="ea-section-title">
                1. Azonosítás
              </h3>

              {isNew ? (
                <div className="space-y-2">
                  <Label>Tétel típusa</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={isCustomMode ? "default" : "outline"}
                      size="sm"
                      className="h-9"
                      onClick={() =>
                        setForm((f) => ({ ...f, isCustomItem: true, identifier: "" }))
                      }
                    >
                      Egyedi K-tétel
                    </Button>
                    <Button
                      type="button"
                      variant={!isCustomMode ? "default" : "outline"}
                      size="sm"
                      className="h-9"
                      onClick={() =>
                        setForm((f) => ({ ...f, isCustomItem: false, identifier: f.identifier }))
                      }
                    >
                      Kódolt tétel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Badge variant={isCustomMode ? "warning" : "secondary"}>
                    {isCustomMode ? "Egyedi K-tétel" : "Kódolt tétel"}
                  </Badge>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="trade">Szakág</Label>
                  <Select
                    value={form.trade}
                    onValueChange={(v) => {
                      const trade = v as Trade
                      setForm((f) => ({
                        ...f,
                        trade,
                        categoryId: getDefaultCategoryForTrade(trade, categories),
                      }))
                    }}
                  >
                    <SelectTrigger id="trade">
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
                  <Label>Kategória / szekció</Label>
                  <Select
                    value={form.categoryId}
                    onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categoriesForTrade.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.parentId ? cat.name : `${cat.name} (általános)`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-lg border bg-slate-50 px-3 py-2.5">
                {isCustomMode ? (
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="text-xs text-slate-500">Tételszám</span>
                      <span className="font-code text-sm font-semibold text-slate-800">
                        {isNew ? (previewIdentifier ?? "…") : form.identifier}
                      </span>
                      {isNew ? (
                        <Badge variant="outline" className="font-normal">
                          automatikus
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-slate-500">Ajánlatban megjelenik: K-tétel</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="identifier" className="text-xs text-slate-500">
                      Tételszám
                    </Label>
                    <Input
                      id="identifier"
                      value={form.identifier}
                      onChange={(e) => setForm((f) => ({ ...f, identifier: e.target.value }))}
                      className="font-code bg-white"
                      placeholder="pl. 71-000-K"
                      required
                      disabled={!isNew}
                    />
                  </div>
                )}
              </div>
            </section>

            {/* 2. Tétel leírása */}
            <section className="space-y-3">
              <h3 className="ea-section-title">
                2. Tétel leírása
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="text">Mit csinál a tétel?</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={!form.text.trim() || polishLoading}
                    onClick={handleTextBlur}
                  >
                    <Sparkles className="mr-1 h-3 w-3" />
                    Javítás
                  </Button>
                </div>
                <Textarea
                  ref={textRef}
                  id="text"
                  value={form.text}
                  onChange={(e) => handleTextChange(e.target.value)}
                  onBlur={handleTextBlur}
                  rows={4}
                  placeholder="pl. Hűtőkör rézcső szerelés, szigetelt, falon belül"
                  className={cn(polishedTextareaClass(Boolean(polishResult?.changed)))}
                  required
                />
                <ItemTextPolishPanel
                  result={polishResult}
                  loading={polishLoading}
                  onRevert={handleRevertPolish}
                />
              </div>
            </section>

            {/* 3. ME és árak */}
            <section className="space-y-3">
              <h3 className="ea-section-title">
                3. Mértékegység és árak
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Mértékegység</Label>
                  <Select
                    value={form.unitId}
                    onValueChange={(v) => setForm((f) => ({ ...f, unitId: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {units.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id}>
                          {unit.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Anyag egységár (Ft)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.materialUnitPrice}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, materialUnitPrice: Number(e.target.value) }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Díj egységre (Ft)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.laborUnitPrice}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, laborUnitPrice: Number(e.target.value) }))
                    }
                  />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border bg-slate-50 px-4 py-3">
                <span className="text-sm text-slate-600">
                  Összesen / {units.find((u) => u.id === form.unitId)?.code ?? "ME"}
                </span>
                <span className="text-lg font-semibold">{formatHuf(total)}</span>
              </div>
            </section>

            {/* 4. Egyéb (opcionális) */}
            <section className="space-y-3 border-t pt-4">
              <h3 className="ea-section-title">
                4. Egyéb (opcionális)
              </h3>
              <div className="space-y-2">
                <Label htmlFor="status">Státusz</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((f) => ({ ...f, status: v as CostItemStatus }))}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Aktív</SelectItem>
                    <SelectItem value="draft">Piszkozat</SelectItem>
                    <SelectItem value="archived">Archivált</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="shortLabel">Rövid címke (lista nézethez)</Label>
                <Input
                  id="shortLabel"
                  value={form.shortLabel ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, shortLabel: e.target.value || null }))
                  }
                  placeholder="Üresen a tétel szövegéből vágjuk"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tags">Címkék</Label>
                <Input
                  id="tags"
                  value={form.tags.join(", ")}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      tags: e.target.value
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean),
                    }))
                  }
                  placeholder="Hyundai, klíma, YAWAL"
                />
              </div>
            </section>
          </SheetBody>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {isNew ? "Mégse" : "Bezárás"}
            </Button>
            {isNew ? (
              <Button type="submit" disabled={similar.length > 0 && !forceSave}>
                Mentés (⌘S)
              </Button>
            ) : (
              <span className="self-center text-xs text-slate-500">Automatikus mentés</span>
            )}
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
