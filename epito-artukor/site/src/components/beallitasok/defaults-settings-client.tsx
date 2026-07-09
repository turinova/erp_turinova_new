"use client"

import { useCallback } from "react"
import { Percent, RotateCcw, Save, SlidersHorizontal } from "lucide-react"
import type { Trade } from "@/types"
import { useTradeOptions } from "@/components/trades/trades-provider"
import { useAppSettingsPage } from "@/hooks/use-app-settings-page"
import { PageHeader } from "@/components/shell/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const numericInputNoSpinner =
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"

export function DefaultsSettingsClient() {
  const tradeOptions = useTradeOptions()
  const { loading, form, setForm, saving, handleSave, handleReset } = useAppSettingsPage()

  const patchMarkup = useCallback(
    (trade: Trade, value: string) => {
      const parsed = Number.parseInt(value, 10)
      setForm((prev) => ({
        ...prev,
        defaultTradeMarkups: {
          ...prev.defaultTradeMarkups,
          [trade]: Number.isFinite(parsed) ? Math.max(0, parsed) : 0,
        },
      }))
    },
    [setForm]
  )

  const patchMinMargin = useCallback(
    (value: string) => {
      const parsed = Number.parseInt(value, 10)
      setForm((prev) => ({
        ...prev,
        minAcceptableMarginPercent: Number.isFinite(parsed) ? Math.max(0, parsed) : 0,
      }))
    },
    [setForm]
  )

  if (loading) {
    return <div className="h-64 animate-pulse rounded-lg bg-[var(--muted)]" />
  }

  return (
    <>
      <PageHeader
        title="Alapértelmezések"
        description="Szakági fedezet % és minimum fedezet küszöb — új költségvetéseknél és árazási ellenőrzéseknél"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void handleReset()} disabled={saving}>
              <RotateCcw className="mr-1.5 h-4 w-4" />
              Alapértelmezés
            </Button>
            <Button type="button" size="sm" onClick={() => void handleSave()} disabled={saving}>
              <Save className="mr-1.5 h-4 w-4" />
              Mentés
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,1fr)]">
        <div className="space-y-6">
          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Szakági fedezet %</h2>
            <p className="mt-1 text-xs text-slate-600">
              Új költségvetés létrehozásakor ezek az értékek kerülnek a szakági fedezet mezőbe. Soronként
              és szakáganként felülírható az árazás lépésben.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {tradeOptions.map((trade) => (
                <div key={trade.id} className="space-y-1.5">
                  <Label htmlFor={`markup-${trade.id}`}>{trade.label}</Label>
                  <div className="relative">
                    <Input
                      id={`markup-${trade.id}`}
                      type="number"
                      min={0}
                      step={1}
                      className={numericInputNoSpinner}
                      value={form.defaultTradeMarkups[trade.id] ?? 0}
                      onChange={(e) => patchMarkup(trade.id, e.target.value)}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                      %
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Minimum elfogadható fedezet</h2>
            <p className="mt-1 text-xs text-slate-600">
              Ha a teljes költségvetés fedezete ez alatt van, figyelmeztetés jelenik meg az árazás és
              küldhetőség ellenőrzésénél.
            </p>
            <div className="mt-4 max-w-xs">
              <Label htmlFor="min-margin">Küszöb %</Label>
              <div className="relative mt-1.5">
                <Input
                  id="min-margin"
                  type="number"
                  min={0}
                  step={1}
                  className={numericInputNoSpinner}
                  value={form.minAcceptableMarginPercent}
                  onChange={(e) => patchMinMargin(e.target.value)}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                  %
                </span>
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <SlidersHorizontal className="h-4 w-4 text-slate-500" />
              Hatás
            </div>
            <ul className="space-y-2 text-xs leading-relaxed text-slate-600">
              <li>Új költségvetés: szakági fedezet % másolása</li>
              <li>Árazás panel: alapértelmezett sor- és szakágérték</li>
              <li>KPI sáv, státusz chip: alacsony fedezet figyelmeztetés</li>
              <li>Projekt összesítő: fedezet célérték összehasonlítás</li>
            </ul>
            <div className="mt-4 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <Percent className="h-3.5 w-3.5 shrink-0" />
              Meglévő költségvetések értékei nem változnak automatikusan.
            </div>
          </section>
        </aside>
      </div>
    </>
  )
}
