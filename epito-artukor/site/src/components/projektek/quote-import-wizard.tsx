"use client"

import { useCallback, useMemo, useState } from "react"
import { CheckCircle2, ClipboardPaste, Loader2, Sparkles } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import type { QuoteImportPreviewResponse, QuoteImportPreviewRow } from "@/lib/cost-items/quote-import-types"
import { importQuoteLinesBatch } from "@/lib/data/projects-store"
import { getTradeLabel } from "@/lib/trades"
import { QuoteImportPreviewTable } from "@/components/projektek/quote-import-preview-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

type QuoteImportWizardProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  onCompleted: () => void
}

const STEPS = ["Beillesztés", "Előnézet", "Eredmény"] as const

type ExecuteSummary = {
  createdQuotes: number
  addedLines: number
  skippedDuplicates: number
  skippedUnmatched: number
  failed: number
}

export function QuoteImportWizard({
  open,
  onOpenChange,
  projectId,
  onCompleted,
}: QuoteImportWizardProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const [pasteText, setPasteText] = useState("")
  const [preview, setPreview] = useState<QuoteImportPreviewResponse | null>(null)
  const [rows, setRows] = useState<QuoteImportPreviewRow[]>([])
  const [loading, setLoading] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [summary, setSummary] = useState<ExecuteSummary | null>(null)

  const reset = useCallback(() => {
    setStepIndex(0)
    setPasteText("")
    setPreview(null)
    setRows([])
    setSummary(null)
    setLoading(false)
    setExecuting(false)
  }, [])

  const handleOpenChange = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const groups = useMemo(() => {
    const grouped = new Map<string, {
      trade: string
      tradeLabel: string
      targetQuoteId: string | null
      targetQuoteLabel: string
      rows: QuoteImportPreviewRow[]
    }>()

    for (const row of rows) {
      if (!row.trade) continue
      if (!grouped.has(row.trade)) {
        grouped.set(row.trade, {
          trade: row.trade,
          tradeLabel: preview?.groups.find((g) => g.trade === row.trade)?.tradeLabel ?? getTradeLabel(row.trade),
          targetQuoteId: row.targetQuoteId,
          targetQuoteLabel: row.targetQuoteLabel ?? row.trade,
          rows: [],
        })
      }
      grouped.get(row.trade)!.rows.push(row)
    }

    return [...grouped.values()].sort((a, b) =>
      a.tradeLabel.localeCompare(b.tradeLabel, "hu")
    )
  }, [preview, rows])

  const importableCount = rows.filter((r) => r.included && r.errors.length === 0).length

  const handlePreview = async () => {
    if (!pasteText.trim()) {
      toast.error("Illeszd be legalább egy tétel nevét.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/quotes/import/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pasteText }),
      })
      const data = (await res.json()) as QuoteImportPreviewResponse & { error?: string }
      if (!res.ok) throw new Error(data.error ?? "Előnézet sikertelen")

      setPreview(data)
      setRows(data.rows)
      setStepIndex(1)
      toast.success(
        data.aiAvailable
          ? `Előnézet kész — ${data.matched_count}/${data.row_count} párosítva (AI: ${data.aiUsedCount})`
          : `Előnézet kész — ${data.matched_count}/${data.row_count} párosítva`
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Előnézet hiba")
    } finally {
      setLoading(false)
    }
  }

  const handleExecute = async () => {
    const importable = rows.filter((r) => r.included && r.errors.length === 0)
    if (!importable.length) {
      toast.error("Nincs importálható sor.")
      return
    }

    setExecuting(true)
    try {
      const result = importQuoteLinesBatch(
        projectId,
        importable.map((row) => ({
          lineNumber: row.lineNumber,
          matchedCostItemId: row.matchedCostItemId,
          trade: row.trade,
          quantity: row.quantity,
          targetQuoteId: row.targetQuoteId,
          targetQuoteAction: row.targetQuoteAction,
          included: row.included,
        })),
        { createMissingQuotes: true, duplicatePolicy: "skip" }
      )

      setSummary(result)
      setStepIndex(2)
      onCompleted()
      toast.success(`Import kész — ${result.addedLines} sor hozzáadva`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import hiba")
    } finally {
      setExecuting(false)
    }
  }

  const handleRowsChange = (nextRows: QuoteImportPreviewRow[]) => {
    setRows(nextRows)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <ClipboardPaste className="h-5 w-5" />
            Költségvetés importálása
          </DialogTitle>
          <p className="text-sm text-slate-600">
            Beilleszted az Excel tételneveit — a rendszer párosítja a katalógusban lévő K-tételekhez,
            és szakág szerint költségvetés sorokat hoz létre.
          </p>
        </DialogHeader>

        <div className="flex shrink-0 items-center gap-2 border-b px-6 py-3">
          {STEPS.map((label, idx) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold",
                  idx < stepIndex
                    ? "bg-emerald-100 text-emerald-700"
                    : idx === stepIndex
                      ? "bg-[var(--page-accent)]/15 text-[var(--page-accent)]"
                      : "bg-slate-100 text-slate-500"
                )}
              >
                {idx < stepIndex ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
              </div>
              <span
                className={cn(
                  "text-sm",
                  idx === stepIndex ? "font-medium text-slate-900" : "text-slate-500"
                )}
              >
                {label}
              </span>
              {idx < STEPS.length - 1 ? (
                <span className="mx-1 text-slate-300">→</span>
              ) : null}
            </div>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {stepIndex === 0 ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600">
                <p className="font-medium text-slate-800">Hogyan működik?</p>
                <ul className="mt-2 list-inside list-disc space-y-1">
                  <li>Egy sor = egy tétel neve (a Szöveg oszlopból másold)</li>
                  <li>Opcionális: szöveg[TAB]mennyiség[TAB]egység</li>
                  <li>Nem hoz létre új K-tételt — csak a meglévő katalógushoz párosít</li>
                  <li>Hiányzó szakági költségvetéseket automatikusan létrehozza</li>
                </ul>
              </div>
              <Textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={"Mobil WC bérleti díj…\nEgyoldali falzsaluzás…\nHagyományos fa fedélszerkezet…"}
                rows={14}
                className="font-mono text-sm"
              />
              <p className="text-xs text-slate-500">
                Tipp: Excelben fülenként másold ki a Szöveg oszlopot, vagy illeszd be egyszerre az
                összes tételt.
              </p>
            </div>
          ) : null}

          {stepIndex === 1 && preview ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{preview.row_count} sor</Badge>
                <Badge variant="success">{preview.matched_count} párosítva</Badge>
                {preview.unmatched_count > 0 ? (
                  <Badge variant="warning">{preview.unmatched_count} nincs a katalógusban</Badge>
                ) : null}
                {preview.aiAvailable ? (
                  <Badge variant="secondary" className="gap-1">
                    <Sparkles className="h-3 w-3" />
                    AI ({preview.aiUsedCount})
                  </Badge>
                ) : null}
              </div>

              {preview.unmatched_count > 0 ? (
                <p className="text-sm text-amber-800">
                  {preview.unmatched_count} tétel nincs a katalógusban.{" "}
                  <Link href="/import" className="font-medium underline">
                    K-tétel import
                  </Link>{" "}
                  oldalon veheted fel őket először.
                </p>
              ) : null}

              <QuoteImportPreviewTable
                groups={groups}
                rows={rows}
                catalogItems={preview.catalogItems}
                existingQuotes={preview.existingQuotes}
                onChange={handleRowsChange}
              />
            </div>
          ) : null}

          {stepIndex === 2 && summary ? (
            <div className="space-y-4 py-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border bg-emerald-50 p-4">
                  <p className="text-2xl font-bold text-emerald-800">{summary.addedLines}</p>
                  <p className="text-sm text-emerald-700">sor hozzáadva</p>
                </div>
                <div className="rounded-lg border bg-blue-50 p-4">
                  <p className="text-2xl font-bold text-blue-800">{summary.createdQuotes}</p>
                  <p className="text-sm text-blue-700">új szakági költségvetés</p>
                </div>
                {summary.skippedDuplicates > 0 ? (
                  <div className="rounded-lg border bg-slate-50 p-4">
                    <p className="text-2xl font-bold text-slate-800">{summary.skippedDuplicates}</p>
                    <p className="text-sm text-slate-600">duplikátum kihagyva</p>
                  </div>
                ) : null}
                {summary.failed > 0 ? (
                  <div className="rounded-lg border bg-red-50 p-4">
                    <p className="text-2xl font-bold text-red-800">{summary.failed}</p>
                    <p className="text-sm text-red-700">sikertelen sor</p>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="shrink-0 border-t px-6 py-4">
          {stepIndex === 0 ? (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Mégse
              </Button>
              <Button onClick={handlePreview} disabled={loading || !pasteText.trim()}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Előnézet
              </Button>
            </>
          ) : null}

          {stepIndex === 1 ? (
            <>
              <Button variant="outline" onClick={() => setStepIndex(0)}>
                Vissza
              </Button>
              <Button onClick={handleExecute} disabled={executing || importableCount === 0}>
                {executing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Import ({importableCount} sor)
              </Button>
            </>
          ) : null}

          {stepIndex === 2 ? (
            <Button onClick={() => handleOpenChange(false)}>Bezárás</Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
