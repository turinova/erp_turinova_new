"use client"

import { useEffect, useMemo, useState } from "react"
import { Sparkles } from "lucide-react"
import type { Category, CostItem, CostItemInput, Trade, Unit } from "@/types"
import { parseQuickItemText } from "@/lib/parse-quick-text"
import { previewNextCustomIdentifier } from "@/lib/item-identifier"
import {
  buildCategoryMap,
  getCategoriesForTradeSelect,
  getDefaultCategoryForTrade,
} from "@/lib/categories/category-tree"
import { cn } from "@/lib/utils"
import { useItemTextPolish } from "@/hooks/use-item-text-polish"
import {
  ItemTextPolishPanel,
  polishedTextareaClass,
} from "@/components/tetelek/item-text-polish-panel"
import { useTradeOptions } from "@/components/trades/trades-provider"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"


function findUnitIdByHint(units: Unit[], hint: string): string | undefined {
  const normalized = hint.toLowerCase()
  return units.find((u) => u.code.toLowerCase() === normalized)?.id
}

type QuickKtetelDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultTrade: Trade
  existingItems: CostItem[]
  categories: Category[]
  units: Unit[]
  onSave: (input: CostItemInput) => void
}

export function QuickKtetelDialog({
  open,
  onOpenChange,
  defaultTrade,
  existingItems,
  categories,
  units,
  onSave,
}: QuickKtetelDialogProps) {
  const tradeOptions = useTradeOptions()
  const categoryMap = useMemo(() => buildCategoryMap(categories), [categories])
  const defaultCategoryId = getDefaultCategoryForTrade(defaultTrade, categories)
  const defaultUnitId = units.find((u) => u.code === "klt")?.id ?? units[0]?.id ?? ""
  const [text, setText] = useState("")
  const [unitId, setUnitId] = useState(defaultUnitId)
  const [material, setMaterial] = useState(0)
  const [labor, setLabor] = useState(0)
  const [trade, setTrade] = useState<Trade>(defaultTrade)
  const [categoryId, setCategoryId] = useState(defaultCategoryId)

  const { polishResult, polishLoading, polishText, clearPolish } = useItemTextPolish()

  const handleTextBlur = async () => {
    const parsed = parseQuickItemText(text)
    if (parsed.materialUnitPrice) setMaterial(parsed.materialUnitPrice)
    if (parsed.laborUnitPrice) setLabor(parsed.laborUnitPrice)
    if (parsed.unitHint) {
      const resolved = findUnitIdByHint(units, parsed.unitHint)
      if (resolved) setUnitId(resolved)
    }
    const toPolish = (parsed.text || text).trim()
    if (!toPolish) return
    const result = await polishText(toPolish, {
      trade,
      categoryId,
      referenceItems: existingItems,
    })
    if (result.changed) setText(result.polished)
  }

  const handleTextChange = (value: string) => {
    clearPolish()
    setText(value)
  }

  const handleRevertPolish = () => {
    if (!polishResult) return
    setText(polishResult.original)
    clearPolish()
  }

  const categoriesForTrade = useMemo(
    () => getCategoriesForTradeSelect(trade, categories),
    [trade, categories]
  )

  useEffect(() => {
    setCategoryId(getDefaultCategoryForTrade(trade, categories))
  }, [trade, categories])

  useEffect(() => {
    if (open) {
      setTrade(defaultTrade)
      setCategoryId(getDefaultCategoryForTrade(defaultTrade, categories))
      setUnitId(defaultUnitId)
      clearPolish()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clearPolish stabil
  }, [open, defaultTrade, categories, defaultUnitId])

  const applyParsed = () => {
    const parsed = parseQuickItemText(text)
    if (parsed.text) setText(parsed.text)
    if (parsed.materialUnitPrice) setMaterial(parsed.materialUnitPrice)
    if (parsed.laborUnitPrice) setLabor(parsed.laborUnitPrice)
    if (parsed.unitHint) {
      const resolved = findUnitIdByHint(units, parsed.unitHint)
      if (resolved) setUnitId(resolved)
    }
  }

  const handleSave = (asDraft: boolean) => {
    if (!text.trim()) return
    onSave({
      trade,
      identifier: "",
      isCustomItem: true,
      text: text.trim(),
      shortLabel: null,
      categoryId,
      unitId,
      status: asDraft ? "draft" : "active",
      tags: [],
      materialUnitPrice: material,
      laborUnitPrice: labor,
    })
    setText("")
    setMaterial(0)
    setLabor(0)
    onOpenChange(false)
  }

  const nextId = previewNextCustomIdentifier(existingItems, categoryId, categoryMap)
  const categoryLabel = categoryMap[categoryId]?.name ?? "Kategória"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gyors K-tétel</DialogTitle>
          <DialogDescription>
            Következő szám: <span className="font-code font-medium">{nextId}</span> ({categoryLabel}
            ). Ajánlatban: K-tétel.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">1. Szakág</Label>
              <Select value={trade} onValueChange={(v) => setTrade(v as Trade)}>
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
            <div className="space-y-1">
              <Label className="text-xs">Szekció</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
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

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>2. Tétel leírása</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={!text.trim() || polishLoading}
                onClick={handleTextBlur}
              >
                <Sparkles className="mr-1 h-3 w-3" />
                Javítás
              </Button>
            </div>
            <Textarea
              value={text}
              onChange={(e) => handleTextChange(e.target.value)}
              onBlur={handleTextBlur}
              rows={3}
              placeholder="pl. Repedt burkolat javítás, anyag 65300 díj 310000 klt"
              className={cn(polishedTextareaClass(Boolean(polishResult?.changed)))}
              autoFocus
            />
            <ItemTextPolishPanel
              result={polishResult}
              loading={polishLoading}
              onRevert={handleRevertPolish}
            />
            <Button type="button" variant="ghost" size="sm" onClick={applyParsed}>
              Szöveg elemzése
            </Button>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">3. Mértékegység és árak</Label>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">ME</Label>
                <Select value={unitId} onValueChange={setUnitId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {units.slice(0, 8).map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.code}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Anyag (Ft)</Label>
                <Input
                  type="number"
                  min={0}
                  value={material}
                  onChange={(e) => setMaterial(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Díj (Ft)</Label>
                <Input
                  type="number"
                  min={0}
                  value={labor}
                  onChange={(e) => setLabor(Number(e.target.value))}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => handleSave(true)}>
            Piszkozat
          </Button>
          <Button type="button" onClick={() => handleSave(false)}>
            Mentés
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
