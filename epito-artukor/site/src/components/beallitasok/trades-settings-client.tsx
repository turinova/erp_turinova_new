"use client"

import { useEffect, useState } from "react"
import { ArrowDown, ArrowUp, Plus, RotateCcw, Save } from "lucide-react"
import { toast } from "sonner"
import type { TradeRecord } from "@/types/trade"
import { DEFAULT_TRADE_RECORDS } from "@/lib/trades/constants"
import { normalizeTradeCodeInput, validateNewTradeInput } from "@/lib/trades/validate-trade"
import {
  createTradeSupabase,
  persistTradesSupabase,
  useTrades,
} from "@/components/trades/trades-provider"
import { PageHeader } from "@/components/shell/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

type FormRow = TradeRecord

function normalizeRows(rows: TradeRecord[]): FormRow[] {
  return [...rows]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((row, index) => ({ ...row, sortOrder: index + 1 }))
}

export function TradesSettingsClient() {
  const { trades, loading, refreshTrades } = useTrades()
  const [form, setForm] = useState<FormRow[]>([])
  const [saving, setSaving] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [newCode, setNewCode] = useState("")
  const [newName, setNewName] = useState("")

  useEffect(() => {
    if (!loading) setForm(normalizeRows(trades))
  }, [trades, loading])

  const patchName = (id: string, name: string) => {
    setForm((prev) => prev.map((row) => (row.id === id ? { ...row, name } : row)))
  }

  const moveRow = (index: number, direction: -1 | 1) => {
    setForm((prev) => {
      const next = [...prev]
      const target = index + direction
      if (target < 0 || target >= next.length) return prev
      const tmp = next[index]
      next[index] = next[target]
      next[target] = tmp
      return normalizeRows(next)
    })
  }

  const handleSave = async () => {
    const payload = normalizeRows(form)
    if (payload.some((row) => !row.name.trim())) {
      toast.error("Minden szakágnak kell megnevezés.")
      return
    }

    setSaving(true)
    try {
      const result = await persistTradesSupabase(payload)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setForm(normalizeRows(result.trades))
      await refreshTrades()
      toast.success("Szakágak mentve")
    } catch {
      toast.error("Mentés sikertelen")
    } finally {
      setSaving(false)
    }
  }

  const handleCreate = async () => {
    const validation = validateNewTradeInput(
      newCode,
      newName,
      form.map((row) => row.code)
    )
    if (!validation.ok) {
      toast.error(validation.error)
      return
    }

    setSaving(true)
    try {
      const result = await createTradeSupabase(validation.code, validation.name)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      await refreshTrades()
      setCreateOpen(false)
      setNewCode("")
      setNewName("")
      toast.success("Új szakág létrehozva")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Létrehozás sikertelen")
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (!confirm("Visszaállítod az alapértelmezett szakág-neveket és sorrendet?")) return
    const defaults = normalizeRows(DEFAULT_TRADE_RECORDS)
    setSaving(true)
    try {
      const result = await persistTradesSupabase(
        defaults.map((d) => ({
          ...d,
          id: form.find((f) => f.code === d.code)?.id ?? d.id,
        }))
      )
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      await refreshTrades()
      toast.success("Alapértelmezés visszaállítva")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="h-64 animate-pulse rounded-lg bg-[var(--muted)]" />
  }

  return (
    <>
      <PageHeader
        title="Szakágak"
        description="Szakágak kezelése"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCreateOpen(true)}
              disabled={saving}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Új szakág
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => void handleReset()} disabled={saving}>
              <RotateCcw className="mr-1.5 h-4 w-4" />
              Alapértelmezés
            </Button>
            <Button type="button" size="sm" onClick={() => void handleSave()} disabled={saving}>
              <Save className="mr-1.5 h-4 w-4" />
              {saving ? "Mentés…" : "Mentés"}
            </Button>
          </div>
        }
      />

      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="ea-table-head">
            <tr>
              <th className="w-12 px-4 py-3 text-left">#</th>
              <th className="px-4 py-3 text-left">Kód</th>
              <th className="px-4 py-3 text-left">Megnevezés</th>
              <th className="w-28 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {form.map((row, index) => (
              <tr key={row.id} className="border-b last:border-b-0">
                <td className="px-4 py-3 text-[var(--muted-foreground)]">{row.sortOrder}</td>
                <td className="px-4 py-3 font-code text-xs font-medium text-[var(--brand)]">
                  {row.code}
                </td>
                <td className="px-4 py-3">
                  <Label htmlFor={`trade-name-${row.id}`} className="sr-only">
                    {row.code} megnevezése
                  </Label>
                  <Input
                    id={`trade-name-${row.id}`}
                    value={row.name}
                    onChange={(e) => patchName(row.id, e.target.value)}
                    disabled={saving}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={saving || index === 0}
                      onClick={() => moveRow(index, -1)}
                      title="Fel"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={saving || index === form.length - 1}
                      onClick={() => moveRow(index, 1)}
                      title="Le"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-[var(--muted-foreground)]">
        A <strong>kód</strong> belső azonosító (pl. <code className="font-code">burkolas</code>) —
        létrehozás után nem változtatható. A <strong>megnevezés</strong> bárhol megjelenhet az appban.
        Új szakághoz utána hozz létre kategóriákat a Kategóriák oldalon.
      </p>

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Új szakág</SheetTitle>
          </SheetHeader>
          <SheetBody className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-trade-code">Kód</Label>
              <Input
                id="new-trade-code"
                value={newCode}
                onChange={(e) => setNewCode(normalizeTradeCodeInput(e.target.value))}
                placeholder="pl. burkolas"
                className="font-code"
                autoComplete="off"
              />
              <p className="text-[11px] text-[var(--muted-foreground)]">
                Kisbetű, szám, kötőjel. Pl. „Burkolás” → <code className="font-code">burkolas</code>
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-trade-name">Megnevezés</Label>
              <Input
                id="new-trade-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="pl. Burkolás"
                autoComplete="off"
              />
            </div>
          </SheetBody>
          <SheetFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>
              Mégse
            </Button>
            <Button onClick={() => void handleCreate()} disabled={saving}>
              {saving ? "Létrehozás…" : "Létrehozás"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
