"use client"

import { useCallback, useRef, useState } from "react"
import {
  CheckCircle2,
  ClipboardPaste,
  Download,
  FileUp,
  Loader2,
  Sparkles,
  Upload,
} from "lucide-react"
import { toast } from "sonner"
import type { Category, Unit } from "@/types"
import type { CostItemImportRow } from "@/lib/cost-items/cost-items-xlsx"
import {
  pastePreviewToImportRows,
  type IdentifierPoolItem,
  type PastePreviewRow,
} from "@/lib/cost-items/paste-import"
import { PasteImportPreviewTable } from "@/components/import/paste-import-preview-table"
import { PageHeader } from "@/components/shell/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

type ImportTab = "paste" | "excel"
type ImportMode = "upsert" | "create_only"

type PreviewResponse = {
  filename?: string
  mode?: ImportMode
  row_count?: number
  error_count?: number
  warning_count?: number
  create_count?: number
  update_count?: number
  skip_count?: number
  rows?: CostItemImportRow[]
  error?: string
}

type PastePreviewResponse = {
  rows?: PastePreviewRow[]
  trades?: Array<{ id: string; code: string; name: string }>
  categories?: Category[]
  units?: Unit[]
  existingIdentifiers?: IdentifierPoolItem[]
  aiAvailable?: boolean
  aiUsedCount?: number
  row_count?: number
  error_count?: number
  warning_count?: number
  error?: string
}

type ExecuteSummary = {
  created: number
  updated: number
  skipped: number
  failed: number
}

type FailedRow = {
  rowNumber: number
  tetelszam: string | null
  reason: string
}

const STEPS = ["Feltöltés", "Előnézet", "Eredmény"] as const

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function actionLabel(action: CostItemImportRow["action"]): string {
  if (action === "CREATE") return "Új"
  if (action === "UPDATE") return "Frissítés"
  return "Kihagyva"
}

function actionVariant(action: CostItemImportRow["action"]): "success" | "warning" | "secondary" {
  if (action === "CREATE") return "success"
  if (action === "UPDATE") return "warning"
  return "secondary"
}

export function ImportPageClient() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importTab, setImportTab] = useState<ImportTab>("paste")
  const [stepIndex, setStepIndex] = useState(0)
  const [importMode, setImportMode] = useState<ImportMode>("create_only")
  const [filename, setFilename] = useState<string | null>(null)
  const [previewRows, setPreviewRows] = useState<CostItemImportRow[]>([])
  const [pasteText, setPasteText] = useState("")
  const [pasteRows, setPasteRows] = useState<PastePreviewRow[]>([])
  const [pasteTrades, setPasteTrades] = useState<Array<{ id: string; code: string; name: string }>>(
    []
  )
  const [pasteCategories, setPasteCategories] = useState<Category[]>([])
  const [pasteUnits, setPasteUnits] = useState<Unit[]>([])
  const [pasteExistingIdentifiers, setPasteExistingIdentifiers] = useState<IdentifierPoolItem[]>(
    []
  )
  const [pasteMeta, setPasteMeta] = useState({ aiAvailable: false, aiUsedCount: 0 })
  const [previewStats, setPreviewStats] = useState({
    create: 0,
    update: 0,
    skip: 0,
    errors: 0,
    warnings: 0,
  })
  const [uploading, setUploading] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [downloading, setDownloading] = useState<"template" | "export" | null>(null)
  const [summary, setSummary] = useState<ExecuteSummary | null>(null)
  const [failedRows, setFailedRows] = useState<FailedRow[]>([])

  const resetImportState = useCallback(() => {
    setStepIndex(0)
    setFilename(null)
    setPreviewRows([])
    setPasteRows([])
    setPasteTrades([])
    setPasteCategories([])
    setPasteUnits([])
    setPasteExistingIdentifiers([])
    setPasteMeta({ aiAvailable: false, aiUsedCount: 0 })
    setPreviewStats({ create: 0, update: 0, skip: 0, errors: 0, warnings: 0 })
    setSummary(null)
    setFailedRows([])
  }, [])

  const handleDownloadTemplate = async () => {
    setDownloading("template")
    try {
      const res = await fetch("/api/cost-items/template")
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Sablon letöltés sikertelen.")
      }
      const blob = await res.blob()
      const timestamp = new Date().toISOString().split("T")[0]
      downloadBlob(blob, `tetelek_sablon_${timestamp}.xlsx`)
      toast.success("Sablon letöltve")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sablon letöltési hiba")
    } finally {
      setDownloading(null)
    }
  }

  const handleExport = async () => {
    setDownloading("export")
    try {
      const res = await fetch("/api/cost-items/export")
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Export sikertelen.")
      }
      const blob = await res.blob()
      const timestamp = new Date().toISOString().split("T")[0]
      downloadBlob(blob, `tetelek_export_${timestamp}.xlsx`)
      toast.success("Export letöltve")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export hiba")
    } finally {
      setDownloading(null)
    }
  }

  const handlePastePreview = async () => {
    if (!pasteText.trim()) {
      toast.error("Illeszd be legalább egy tétel nevét.")
      return
    }

    setUploading(true)
    try {
      const res = await fetch("/api/cost-items/import/paste-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pasteText }),
      })
      const data = (await res.json()) as PastePreviewResponse
      if (!res.ok) throw new Error(data.error ?? "Előnézet sikertelen")

      setPasteRows(data.rows ?? [])
      setPasteTrades(data.trades ?? [])
      setPasteCategories(data.categories ?? [])
      setPasteUnits(data.units ?? [])
      setPasteExistingIdentifiers(data.existingIdentifiers ?? [])
      setPasteMeta({
        aiAvailable: data.aiAvailable ?? false,
        aiUsedCount: data.aiUsedCount ?? 0,
      })
      setFilename("Gyors beillesztés")
      setPreviewStats({
        create: (data.rows ?? []).filter((r) => r.included && r.errors.length === 0).length,
        update: 0,
        skip: (data.rows ?? []).filter((r) => !r.included).length,
        errors: data.error_count ?? 0,
        warnings: data.warning_count ?? 0,
      })
      setStepIndex(1)
      toast.success(
        data.aiAvailable
          ? `AI előnézet kész (${data.aiUsedCount ?? 0} sor AI-val)`
          : "Előnézet kész (kulcsszó-alapú besorolás)"
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Előnézet hiba")
    } finally {
      setUploading(false)
    }
  }

  const handleFileSelected = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("Csak .xlsx fájl tölthető fel.")
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("mode", importMode)

      const res = await fetch("/api/cost-items/import/preview", {
        method: "POST",
        body: formData,
      })
      const data = (await res.json()) as PreviewResponse
      if (!res.ok) throw new Error(data.error ?? "Előnézet sikertelen")

      setFilename(data.filename ?? file.name)
      setPreviewRows(data.rows ?? [])
      setPreviewStats({
        create: data.create_count ?? 0,
        update: data.update_count ?? 0,
        skip: data.skip_count ?? 0,
        errors: data.error_count ?? 0,
        warnings: data.warning_count ?? 0,
      })
      setStepIndex(1)
      toast.success("Előnézet elkészült")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Feltöltési hiba")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleExecuteImport = async () => {
    let rowsToImport: CostItemImportRow[] = []

    if (importTab === "paste") {
      rowsToImport = pastePreviewToImportRows(pasteRows, pasteTrades, pasteCategories, pasteUnits)
    } else {
      rowsToImport = previewRows
    }

    const importable = rowsToImport.filter((r) => r.action !== "SKIP" && r.errors.length === 0)
    if (!importable.length) {
      toast.error("Nincs importálható sor.")
      return
    }

    setExecuting(true)
    try {
      const res = await fetch("/api/cost-items/import/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: importTab === "paste" ? "create_only" : importMode,
          rows: rowsToImport,
        }),
      })
      const data = (await res.json()) as {
        summary?: ExecuteSummary
        failedRows?: FailedRow[]
        error?: string
      }
      if (!res.ok) throw new Error(data.error ?? "Import futtatás sikertelen")

      setSummary(data.summary ?? null)
      setFailedRows(data.failedRows ?? [])
      setStepIndex(2)
      toast.success("Import kész")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import futtatási hiba")
    } finally {
      setExecuting(false)
    }
  }

  const excelImportableCount = previewRows.filter(
    (r) => r.action !== "SKIP" && r.errors.length === 0
  ).length

  const pasteImportableCount = pasteRows.filter(
    (r) => r.included && r.errors.length === 0
  ).length

  const importableCount = importTab === "paste" ? pasteImportableCount : excelImportableCount

  return (
    <>
      <PageHeader
        title="Import / Export"
        description="Gyors beillesztés AI besorolással, vagy haladó Excel import"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              disabled={downloading !== null}
            >
              {downloading === "template" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Sablon
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={downloading !== null}
            >
              {downloading === "export" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Export
            </Button>
          </div>
        }
      />

      <div className="mb-6 flex gap-2 border-b">
        <button
          type="button"
          onClick={() => {
            if (stepIndex === 0) setImportTab("paste")
          }}
          className={cn(
            "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
            importTab === "paste"
              ? "border-[var(--page-accent)] text-[var(--page-accent)]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          )}
        >
          <ClipboardPaste className="mr-1.5 inline h-4 w-4" />
          Gyors beillesztés
        </button>
        <button
          type="button"
          onClick={() => {
            if (stepIndex === 0) setImportTab("excel")
          }}
          className={cn(
            "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
            importTab === "excel"
              ? "border-[var(--page-accent)] text-[var(--page-accent)]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          )}
        >
          <FileUp className="mr-1.5 inline h-4 w-4" />
          Excel import
        </button>
      </div>

      <div className="mb-8 flex items-center gap-2">
        {STEPS.map((label, idx) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium",
                idx < stepIndex
                  ? "bg-emerald-100 text-emerald-700"
                  : idx === stepIndex
                    ? "bg-blue-600 text-white"
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
              <div className="mx-2 h-px w-8 bg-slate-200" />
            ) : null}
          </div>
        ))}
      </div>

      {stepIndex === 0 && importTab === "paste" ? (
        <div className="space-y-4">
          <div className="rounded-lg border bg-white p-4">
            <p className="mb-2 text-sm font-medium">Tételek beillesztése</p>
            <p className="mb-3 text-sm text-slate-500">
              Egy sor = egy tétel neve. Az AI javasolja a szakágat, kategóriát és mértékegységet —
              az előnézetben mind módosítható. Az anyagár és díj alapból 0 (később a Tételek
              oldalon állítható).
            </p>
            <Textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={`Hidegburkolás falazat előkészítése\nEV töltő alapszerelés\nDurvatakarítás átadás előtt`}
              rows={12}
              className="font-mono text-sm"
            />
            <div className="mt-3 flex justify-end">
              <Button onClick={handlePastePreview} disabled={uploading}>
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                AI előnézet generálása
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {stepIndex === 0 && importTab === "excel" ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-white p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Import mód</p>
              <Select
                value={importMode}
                onValueChange={(v) => setImportMode(v as ImportMode)}
              >
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upsert">Upsert (új + frissítés)</SelectItem>
                  <SelectItem value="create_only">Csak új tételek</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-slate-500">
              Upsert: létező <span className="font-code">tetelszam</span> frissül. Csak új: duplikátum
              kihagyva.
            </p>
          </div>

          <div
            className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-white px-6 py-12 text-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const file = e.dataTransfer.files[0]
              if (file) void handleFileSelected(file)
            }}
          >
            <Upload className="mb-3 h-10 w-10 text-slate-400" />
            <p className="mb-1 font-medium">Húzd ide az .xlsx fájlt</p>
            <p className="mb-4 max-w-lg text-sm text-slate-500">
              Oszlopok: szakag, kategoria, tetelszam, tetel_szovege, mertekegyseg, anyag_egysegar,
              dij_egysegre, statusz, cimkek
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleFileSelected(file)
              }}
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileUp className="h-4 w-4" />
              )}
              Fájl kiválasztása
            </Button>
          </div>
        </div>
      ) : null}

      {stepIndex === 1 ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-slate-50 px-4 py-3">
            <div>
              <p className="font-medium">{filename}</p>
              <p className="text-sm text-slate-600">
                {importTab === "paste" ? (
                  <>
                    {pasteRows.length} sor · {pasteImportableCount} importálható ·{" "}
                    {previewStats.errors} hiba · {previewStats.warnings} figyelmeztetés
                    {pasteMeta.aiAvailable ? (
                      <> · {pasteMeta.aiUsedCount} AI besorolás</>
                    ) : (
                      <> · AI nincs beállítva (kulcsszó-alapú)</>
                    )}
                  </>
                ) : (
                  <>
                    {previewRows.length} sor · {previewStats.create} új · {previewStats.update}{" "}
                    frissítés · {previewStats.skip} kihagyva · {previewStats.errors} hiba ·{" "}
                    {previewStats.warnings} figyelmeztetés
                  </>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={resetImportState}>
                Mégse
              </Button>
              <Button onClick={handleExecuteImport} disabled={executing || importableCount === 0}>
                {executing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Importálás ({importableCount} tétel)
              </Button>
            </div>
          </div>

          {importTab === "paste" ? (
            <PasteImportPreviewTable
              rows={pasteRows}
              trades={pasteTrades}
              categories={pasteCategories}
              units={pasteUnits}
              existingIdentifiers={pasteExistingIdentifiers}
              onChange={setPasteRows}
            />
          ) : (
            <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
              <div className="max-h-[32rem] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="ea-table-head sticky top-0">
                    <tr>
                      <th className="px-3 py-2">Sor</th>
                      <th className="px-3 py-2">Művelet</th>
                      <th className="px-3 py-2">Tételszám</th>
                      <th className="px-3 py-2">Szöveg</th>
                      <th className="px-3 py-2">Szakág</th>
                      <th className="px-3 py-2">Kategória</th>
                      <th className="px-3 py-2">ME</th>
                      <th className="px-3 py-2">Státusz</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row) => (
                      <tr
                        key={row.rowNumber}
                        className={cn(
                          "border-b",
                          row.errors.length > 0 ? "bg-red-50" : "",
                          row.errors.length === 0 && row.warnings.length > 0 ? "bg-amber-50" : ""
                        )}
                      >
                        <td className="px-3 py-2 text-slate-500">{row.rowNumber}</td>
                        <td className="px-3 py-2">
                          <Badge variant={actionVariant(row.action)}>{actionLabel(row.action)}</Badge>
                        </td>
                        <td className="px-3 py-2 font-code text-xs">
                          {row.values.tetelszam || "—"}
                        </td>
                        <td className="max-w-xs truncate px-3 py-2" title={row.values.tetel_szovege}>
                          {row.values.tetel_szovege}
                        </td>
                        <td className="px-3 py-2">{row.values.szakag}</td>
                        <td className="px-3 py-2">{row.values.kategoria}</td>
                        <td className="px-3 py-2">{row.values.mertekegyseg}</td>
                        <td className="px-3 py-2">
                          {row.errors.length > 0 ? (
                            <span className="text-xs text-red-600">{row.errors.join(" ")}</span>
                          ) : row.warnings.length > 0 ? (
                            <span className="text-xs text-amber-700">{row.warnings.join(" ")}</span>
                          ) : (
                            <span className="text-xs text-emerald-600">OK</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {stepIndex === 2 && summary ? (
        <div className="space-y-6">
          <div className="rounded-lg border bg-emerald-50 px-6 py-8 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-600" />
            <p className="text-lg font-semibold text-emerald-900">Import befejezve</p>
            <p className="mt-2 text-emerald-800">
              {summary.created} létrehozva · {summary.updated} frissítve · {summary.skipped}{" "}
              kihagyva · {summary.failed} sikertelen
            </p>
          </div>

          {failedRows.length > 0 ? (
            <div className="overflow-hidden rounded-lg border bg-white">
              <div className="border-b bg-red-50 px-4 py-2 text-sm font-medium text-red-800">
                Sikertelen sorok
              </div>
              <table className="w-full text-sm">
                <thead className="ea-table-head">
                  <tr>
                    <th className="px-4 py-2">Sor</th>
                    <th className="px-4 py-2">Tételszám</th>
                    <th className="px-4 py-2">Hiba</th>
                  </tr>
                </thead>
                <tbody>
                  {failedRows.map((row) => (
                    <tr key={row.rowNumber} className="border-b">
                      <td className="px-4 py-2">{row.rowNumber}</td>
                      <td className="px-4 py-2 font-code text-xs">{row.tetelszam ?? "—"}</td>
                      <td className="px-4 py-2 text-red-600">{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="flex gap-2">
            <Button onClick={resetImportState}>Új import</Button>
            <Button variant="outline" asChild>
              <a href="/tetelek">Tételek megtekintése</a>
            </Button>
          </div>
        </div>
      ) : null}
    </>
  )
}
