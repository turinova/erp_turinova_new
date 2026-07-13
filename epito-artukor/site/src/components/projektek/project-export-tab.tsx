"use client"

import { useMemo, useState } from "react"
import { FileSpreadsheet, FileText, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import type { Project, Quote } from "@/types/projects"
import type { QuoteSummary } from "@/lib/quote-summary"
import { listQuoteLines } from "@/lib/data/projects-store"
import { quoteTradeLabel } from "@/lib/quote-list-helpers"
import { buildProjectExportWorkbook } from "@/lib/project-export/build-project-workbook"
import { buildProjectExportModel } from "@/lib/project-export/build-export-model"
import { buildQuotePdfModel } from "@/lib/project-export/build-quote-pdf-model"
import { validateProjectExport } from "@/lib/project-export/validate-export"
import { downloadArrayBuffer } from "@/lib/project-export/download"
import { printQuotePdfDocument } from "@/lib/project-export/quote-pdf-print"
import { QuoteExportDocument } from "@/components/projektek/quote-export-document"
import type { ProjectExportKind } from "@/lib/project-export/types"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ProjectExportTabProps = {
  project: Project
  quotes: Quote[]
  quoteSummaries: Map<string, QuoteSummary>
}

export function ProjectExportTab({
  project,
  quotes,
  quoteSummaries,
}: ProjectExportTabProps) {
  const [kind, setKind] = useState<ProjectExportKind>("cost")
  const [includeArchived, setIncludeArchived] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(() => {
    const active = quotes.filter((q) => q.status !== "archived").map((q) => q.id)
    return new Set(active)
  })
  const [exporting, setExporting] = useState(false)

  const selectableQuotes = useMemo(
    () =>
      quotes.filter((q) => includeArchived || q.status !== "archived"),
    [quotes, includeArchived]
  )

  const previewModel = useMemo(() => {
    const linesByQuoteId = new Map(
      quotes.map((q) => [q.id, listQuoteLines(q.id)] as const)
    )
    return buildProjectExportModel({
      project,
      kind,
      quotes,
      quoteSummaries,
      linesByQuoteId,
      selectedQuoteIds: [...selected],
      includeArchived,
    })
  }, [project, kind, quotes, quoteSummaries, selected, includeArchived])

  const validation = useMemo(() => validateProjectExport(previewModel), [previewModel])

  const allSelected =
    selectableQuotes.length > 0 &&
    selectableQuotes.every((q) => selected.has(q.id))

  const toggleAll = () => {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(selectableQuotes.map((q) => q.id)))
  }

  const toggleQuote = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const pdfModel = useMemo(() => {
    if (kind !== "sell" || !validation.ok) return null
    const linesByQuoteId = new Map(
      quotes.map((q) => [q.id, listQuoteLines(q.id)] as const)
    )
    try {
      return buildQuotePdfModel({
        project,
        kind: "sell",
        quotes,
        quoteSummaries,
        linesByQuoteId,
        selectedQuoteIds: [...selected],
        includeArchived,
      })
    } catch {
      return null
    }
  }, [kind, validation.ok, project, quotes, quoteSummaries, selected, includeArchived])

  const handleExportPdf = () => {
    if (!validation.ok) {
      toast.error(validation.issues.find((i) => i.level === "error")?.message ?? "Export nem lehetséges")
      return
    }
    if (kind !== "sell") {
      toast.error("PDF export csak árajánlat módban érhető el")
      return
    }
    if (!pdfModel) {
      toast.error("Az árajánlat PDF nem állítható össze")
      return
    }
    try {
      printQuotePdfDocument()
      toast.success("Nyomtatás / PDF mentés megnyitva")
    } catch (error) {
      console.error("quote pdf:", error)
      toast.error(error instanceof Error ? error.message : "PDF export hiba")
    }
  }

  const handleExportExcel = async () => {
    if (!validation.ok) {
      toast.error(validation.issues.find((i) => i.level === "error")?.message ?? "Export nem lehetséges")
      return
    }

    setExporting(true)
    try {
      const linesByQuoteId = new Map(
        quotes.map((q) => [q.id, listQuoteLines(q.id)] as const)
      )
      const { buffer, filename } = await buildProjectExportWorkbook({
        project,
        kind,
        quotes,
        quoteSummaries,
        linesByQuoteId,
        selectedQuoteIds: [...selected],
        includeArchived,
      })
      downloadArrayBuffer(buffer, filename)
      toast.success(`Excel letöltve: ${filename}`)
    } catch (error) {
      console.error("project export:", error)
      toast.error(error instanceof Error ? error.message : "Export hiba")
    } finally {
      setExporting(false)
    }
  }

  if (quotes.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
        <FileSpreadsheet className="h-10 w-10 text-slate-300" />
        <p className="max-w-sm text-sm text-slate-600">
          Még nincs költségvetés ehhez a projekthez. Előbb adj hozzá szakágakat a Költségvetés fülön.
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100dvh-14rem)] flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="border-b border-slate-100 px-5 py-4 sm:flex sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Export</h2>
          <p className="mt-0.5 text-sm text-slate-600">
            Excel főösszesítő + szakágonkénti lapok. A bekerülési export tartalmazza a fedezet és
            ügyfélár oszlopokat is — nem kell külön másolni.
          </p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 sm:mt-0">
          <Button
            disabled={!validation.ok || exporting}
            onClick={handleExportExcel}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            {exporting ? "Generálás…" : "Excel letöltése"}
          </Button>
          {kind === "sell" ? (
            <Button
              variant="outline"
              disabled={!validation.ok}
              onClick={handleExportPdf}
            >
              <FileText className="mr-2 h-4 w-4" />
              PDF letöltése
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid flex-1 gap-6 overflow-auto p-5 lg:grid-cols-2">
        <section className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Export típus</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  { id: "cost" as const, label: "Bekerülési tükör", sub: "Belső — bekerülés + fedezet + eladás" },
                  { id: "sell" as const, label: "Árajánlat", sub: "Ügyfélnek — tiszta költségvetés, ÁFA bontással" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setKind(opt.id)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                    kind === opt.id
                      ? "border-blue-400 bg-blue-50 text-blue-950"
                      : "border-slate-200 hover:border-slate-300"
                  )}
                >
                  <span className="font-medium">{opt.label}</span>
                  <span className="mt-0.5 block text-xs text-slate-600">{opt.sub}</span>
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
            />
            Archivált szakágak is
          </label>

          {validation.issues.length > 0 ? (
            <ul className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-sm">
              {validation.issues.map((issue, i) => (
                <li
                  key={i}
                  className={cn(
                    "flex gap-2",
                    issue.level === "error" ? "text-red-900" : "text-amber-950"
                  )}
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{issue.message}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Szakágak</h3>
            <button
              type="button"
              className="text-xs font-medium text-blue-700 hover:underline"
              onClick={toggleAll}
            >
              {allSelected ? "Kijelölés törlése" : "Összes kijelölése"}
            </button>
          </div>
          <ul className="divide-y rounded-lg border border-slate-200">
            {selectableQuotes.map((q) => {
              const summary = quoteSummaries.get(q.id)
              const checked = selected.has(q.id)
              return (
                <li key={q.id}>
                  <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-slate-300"
                      checked={checked}
                      onChange={() => toggleQuote(q.id)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-900">
                        {quoteTradeLabel(q)}
                      </span>
                      {q.title !== quoteTradeLabel(q) ? (
                        <span className="block truncate text-xs text-slate-600">{q.title}</span>
                      ) : null}
                      {summary ? (
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {summary.lineCount} tétel
                          {summary.isPartialTotal ? " · részleges árazás" : ""}
                        </span>
                      ) : null}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            Az első lap a <strong>Főösszesítő</strong> cégadatokkal és logóval; a szakági lapok közvetlenül a
            tételrácscsal kezdődnek. A főösszesítőn szakágonként látszik a nettó, ÁFA és bruttó bontás, alul
            jobbra az összesítő panel.
          </p>
        </section>
      </div>

      {pdfModel ? (
        <div className="sr-only" aria-hidden>
          <QuoteExportDocument model={pdfModel} />
        </div>
      ) : null}
    </div>
  )
}
