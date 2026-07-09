"use client"

import { useCallback, useRef, useState } from "react"
import {
  CheckCircle2,
  Download,
  FileUp,
  Loader2,
  Upload,
} from "lucide-react"
import { toast } from "sonner"
import type { CostItemImportRow } from "@/lib/cost-items/cost-items-xlsx"
import { PageHeader } from "@/components/shell/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

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
  const [stepIndex, setStepIndex] = useState(0)
  const [importMode, setImportMode] = useState<ImportMode>("upsert")
  const [filename, setFilename] = useState<string | null>(null)
  const [previewRows, setPreviewRows] = useState<CostItemImportRow[]>([])
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
    const importable = previewRows.filter((r) => r.action !== "SKIP" && r.errors.length === 0)
    if (!importable.length) {
      toast.error("Nincs importálható sor.")
      return
    }

    setExecuting(true)
    try {
      const res = await fetch("/api/cost-items/import/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: importMode, rows: previewRows }),
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

  const importableCount = previewRows.filter(
    (r) => r.action !== "SKIP" && r.errors.length === 0
  ).length

  return (
    <>
      <PageHeader
        title="Import / Export"
        description="Tételek Excel (.xlsx) importálása és exportálása — shop-portal minta (előnézet + jóváhagyás)"
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

      {stepIndex === 0 ? (
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
                {previewRows.length} sor · {previewStats.create} új · {previewStats.update}{" "}
                frissítés · {previewStats.skip} kihagyva · {previewStats.errors} hiba ·{" "}
                {previewStats.warnings} figyelmeztetés
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
