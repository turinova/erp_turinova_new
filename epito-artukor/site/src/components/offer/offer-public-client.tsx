"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileDown,
  FileSpreadsheet,
} from "lucide-react"
import { toast } from "sonner"
import type { CustomerPackage, CustomerPackageSnapshot } from "@/types/projects"
import { formatHuf } from "@/lib/pricing"
import type { CustomerPackageResponseType } from "@/lib/customer-package"
import { getTradeLabel } from "@/lib/trades"
import {
  buildOfferPublicExportModel,
  buildOfferPublicPdfModel,
  offerStatusSentence,
  type OfferPublicOrganization,
  type OfferPublicProject,
} from "@/lib/offer-public-export/build-export-model"
import { downloadOfferPublicExcel } from "@/lib/offer-public-export/build-workbook"
import { printQuotePdfDocument } from "@/lib/project-export/quote-pdf-print"
import { QuoteExportDocument } from "@/components/projektek/quote-export-document"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

type OfferPublicClientProps = {
  token: string
}

type OfferPayload = {
  package: CustomerPackage
  project: OfferPublicProject | null
  organization: OfferPublicOrganization | null
}

type OfferMeta = {
  needsCode: true
  status: CustomerPackage["status"]
  expiresAt: string | null
}

function codeStorageKey(token: string) {
  return `offer-code:${token}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("hu-HU", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function TradeSnapshotBlock({ snap }: { snap: CustomerPackageSnapshot }) {
  const lines = snap.lines ?? []
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            {getTradeLabel(snap.trade)}
          </h3>
          <p className="mt-0.5 text-sm text-slate-600">{snap.quoteTitle}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Bruttó
          </p>
          <p className="text-lg font-bold tabular-nums text-slate-950">
            {formatHuf(snap.grossTotal)}
          </p>
          <p className="text-xs text-slate-600">
            Nettó {formatHuf(snap.sellNetTotal ?? 0)}
            {snap.vatLabel ? ` · ${snap.vatLabel}` : null}
          </p>
        </div>
      </div>

      {lines.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[42rem] border-collapse text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-2.5 text-left">Tétel</th>
                <th className="px-3 py-2.5 text-right">Menny.</th>
                <th className="px-3 py-2.5 text-right">Anyag</th>
                <th className="px-3 py-2.5 text-right">Díj</th>
                <th className="px-4 py-2.5 text-right">Nettó</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const hasSplit =
                  line.sellMaterialUnitPrice != null ||
                  line.sellLaborUnitPrice != null
                const mat = hasSplit
                  ? (line.sellMaterialTotal ??
                    Math.round(
                      (line.sellMaterialUnitPrice ?? 0) * line.quantity
                    ))
                  : line.sellNetTotal
                const labor = hasSplit
                  ? (line.sellLaborTotal ??
                    Math.round((line.sellLaborUnitPrice ?? 0) * line.quantity))
                  : 0
                return (
                  <tr key={line.lineId} className="border-b border-slate-100">
                    <td className="px-4 py-2.5 align-top">
                      <p className="font-medium leading-snug text-slate-900">
                        {line.text}
                      </p>
                      {line.identifier ? (
                        <p className="mt-0.5 text-xs text-slate-500">
                          {line.identifier}
                        </p>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-slate-700">
                      {line.quantity} {line.unitLabel}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-slate-800">
                      {formatHuf(mat)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-slate-800">
                      {formatHuf(labor)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums font-semibold text-slate-900">
                      {formatHuf(line.sellNetTotal)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-5 py-4 text-sm text-slate-600">
          Összesített szakág-ajánlat (részletes tétellista nem érhető el).
        </p>
      )}
    </section>
  )
}

export function OfferPublicClient({ token }: OfferPublicClientProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<OfferPayload | null>(null)
  const [meta, setMeta] = useState<OfferMeta | null>(null)
  const [accessCode, setAccessCode] = useState("")
  const [codeError, setCodeError] = useState<string | null>(null)
  const [unlocked, setUnlocked] = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const [responseType, setResponseType] =
    useState<CustomerPackageResponseType>("accept_all")
  const [showOtherDecisions, setShowOtherDecisions] = useState(false)
  const [acceptedQuoteIds, setAcceptedQuoteIds] = useState<string[]>([])
  const [clientName, setClientName] = useState("")
  const [clientNotes, setClientNotes] = useState("")
  const [confirm, setConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [exportingExcel, setExportingExcel] = useState(false)

  const applyPayload = (payload: OfferPayload) => {
    setData(payload)
    setUnlocked(true)
    setMeta(null)
    setAcceptedQuoteIds(payload.package.snapshots.map((s) => s.quoteId))
  }

  const loadData = useCallback(
    async (code: string): Promise<boolean> => {
      const url = code
        ? `/api/offer/${token}?code=${encodeURIComponent(code)}`
        : `/api/offer/${token}`
      const res = await fetch(url)
      if (!res.ok) {
        if (code) {
          const json = await res.json().catch(() => ({}))
          setCodeError(
            res.status === 429
              ? "Túl sok hibás kód — próbálja 15 perc múlva."
              : ((json as { error?: string }).error ??
                  "Hibás kód. Ellenőrizze és próbálja újra.")
          )
          sessionStorage.removeItem(codeStorageKey(token))
          return false
        }
        setError(
          res.status === 404
            ? "Az ajánlat-link nem található."
            : "Nem sikerült betölteni."
        )
        return false
      }
      const json = (await res.json()) as OfferPayload | OfferMeta
      if ("needsCode" in json && json.needsCode) {
        setMeta(json)
        return false
      }
      applyPayload(json as OfferPayload)
      return true
    },
    [token]
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const saved = sessionStorage.getItem(codeStorageKey(token)) ?? ""
        if (saved) setAccessCode(saved)
        await loadData(saved)
      } catch {
        if (!cancelled) setError("Hálózati hiba — próbáld újra később.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, loadData])

  const pkg = data?.package
  const project = data?.project ?? null
  const organization = data?.organization ?? null

  const expired = useMemo(() => {
    const expiresAt = pkg?.expiresAt ?? meta?.expiresAt
    if (!expiresAt) return false
    return new Date(expiresAt).getTime() < Date.now()
  }, [pkg, meta])

  const canDecide = pkg?.status === "sent" && !expired && unlocked

  const status = useMemo(() => {
    if (!pkg && meta) {
      return offerStatusSentence({
        status: meta.status,
        expired,
        expiresAt: meta.expiresAt,
        grossTotal: 0,
      })
    }
    if (!pkg) return ""
    return offerStatusSentence({
      status: pkg.status,
      expired,
      expiresAt: pkg.expiresAt ?? null,
      grossTotal: pkg.grossTotal,
      respondedAt: pkg.respondedAt,
      respondedByName: pkg.respondedByName,
    })
  }, [pkg, meta, expired])

  const exportModel = useMemo(() => {
    if (!pkg) return null
    return buildOfferPublicExportModel({ pkg, project, organization })
  }, [pkg, project, organization])

  const pdfModel = useMemo(
    () => (exportModel ? buildOfferPublicPdfModel(exportModel) : null),
    [exportModel]
  )

  const handleUnlock = async () => {
    const code = accessCode.trim()
    if (!code) return
    setUnlocking(true)
    setCodeError(null)
    try {
      const ok = await loadData(code)
      if (ok) sessionStorage.setItem(codeStorageKey(token), code)
    } finally {
      setUnlocking(false)
    }
  }

  const handleExportExcel = async () => {
    if (!exportModel) return
    setExportingExcel(true)
    try {
      const filename = await downloadOfferPublicExcel(exportModel)
      toast.success(
        `Excel letöltve (${exportModel.trades.length} szakág): ${filename}`
      )
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : "Excel export hiba")
    } finally {
      setExportingExcel(false)
    }
  }

  const handleExportPdf = () => {
    if (!pdfModel) return
    try {
      printQuotePdfDocument(".offer-pdf-doc .quote-export-document")
      toast.success("Nyomtatás / PDF mentés megnyitva")
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : "PDF export hiba")
    }
  }

  const submitLabel =
    responseType === "reject_all"
      ? "Elutasítás rögzítése"
      : responseType === "partial"
        ? "Részleges elfogadás rögzítése"
        : "Elfogadás rögzítése"

  const handleSubmit = async () => {
    if (!pkg || !canDecide) return
    if (!clientName.trim()) {
      toast.error("Add meg a neved")
      return
    }
    if (!confirm) {
      toast.error("Erősítsd meg a döntést a pipával")
      return
    }
    if (responseType === "partial" && acceptedQuoteIds.length === 0) {
      toast.error("Válassz ki legalább egy szakágot")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/offer/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessCode: accessCode.trim() || undefined,
          type: responseType,
          acceptedQuoteIds:
            responseType === "partial" ? acceptedQuoteIds : undefined,
          clientNotes: clientNotes.trim() || undefined,
          respondedByName: clientName.trim(),
          confirm: true,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? "Nem sikerült rögzíteni")
        return
      }
      toast.success("Válaszod rögzítve — köszönjük!")
      setData({
        package: json.package as CustomerPackage,
        project,
        organization,
      })
    } catch {
      toast.error("Hálózati hiba")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <p className="p-6 text-center text-sm text-slate-600">Ajánlat betöltése…</p>
    )
  }

  if (!pkg && meta?.needsCode) {
    return (
      <div className="mx-auto max-w-sm px-4 py-12 sm:py-16">
        <div className="border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-950">Belépés</h1>
          <p className="mt-2 text-sm text-slate-600">
            Írja be a <strong>6 számjegyű belépő kódot</strong> az ajánlat
            megtekintéséhez.
          </p>
          {status ? (
            <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {status}
            </p>
          ) : null}
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-base">Belépő kód</Label>
              <Input
                value={accessCode}
                onChange={(e) => {
                  setAccessCode(e.target.value.replace(/\D/g, ""))
                  setCodeError(null)
                }}
                placeholder="pl. 123456"
                inputMode="numeric"
                className="h-12 text-center text-lg tracking-widest"
                maxLength={6}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleUnlock()
                }}
              />
              {codeError ? (
                <p className="text-sm text-red-600">{codeError}</p>
              ) : null}
            </div>
            <Button
              className="h-12 w-full text-base"
              onClick={() => void handleUnlock()}
              disabled={unlocking}
            >
              {unlocking ? "Ellenőrzés…" : "Ajánlat megnyitása"}
              <ChevronRight className="ml-1 h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (error || !pkg) {
    return (
      <div className="mx-auto max-w-lg p-6 text-center">
        <h1 className="text-xl font-semibold text-slate-900">
          Ajánlat nem elérhető
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          {error ?? "Ismeretlen hiba"}
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 pb-10 sm:p-6">
      <section className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {organization?.legalName ? (
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  {organization.legalName}
                </p>
              ) : (
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Árajánlat
                </p>
              )}
              <h1 className="mt-1 text-xl font-bold text-slate-950 sm:text-2xl">
                {pkg.title}
              </h1>
              {project ? (
                <p className="mt-1 text-sm text-slate-600">
                  {[project.clientName, project.siteAddress]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}
              <p className="mt-3 text-sm font-medium leading-snug text-slate-800">
                {status}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!exportModel || exportingExcel}
                onClick={() => void handleExportExcel()}
              >
                <FileSpreadsheet className="mr-1.5 h-4 w-4" />
                {exportingExcel ? "Excel…" : "Excel"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!pdfModel}
                onClick={handleExportPdf}
              >
                <FileDown className="mr-1.5 h-4 w-4" />
                PDF
              </Button>
            </div>
          </div>
          {pkg.notes ? (
            <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {pkg.notes}
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Összesen bruttó
            </p>
            <p className="text-3xl font-bold tabular-nums text-slate-950">
              {formatHuf(pkg.grossTotal)}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Nettó {formatHuf(pkg.sellNetTotal)}
            </p>
          </div>
          <p className="text-sm text-slate-600">{pkg.snapshots.length} szakág</p>
        </div>
      </section>

      {pkg.status === "superseded" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Ezt az ajánlatot egy újabb verzió váltotta fel — döntés nem rögzíthető.
        </div>
      ) : null}

      {expired && pkg.status === "sent" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Az ajánlat érvényessége lejárt. Kérj frissített ajánlatot a
          kivitelezőtől.
        </div>
      ) : null}

      {(unlocked || pkg.status !== "sent") && (
        <>
          {pkg.snapshots.map((snap) => (
            <TradeSnapshotBlock key={snap.quoteId} snap={snap} />
          ))}

          {canDecide ? (
            <section className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <div className="border-b border-slate-100 px-5 py-3.5">
                <h2 className="text-base font-semibold text-slate-900">
                  Döntés az ajánlatról
                </h2>
                <p className="mt-0.5 text-sm text-slate-600">
                  A rögzítés írásbeli elfogadásnak / elutasításnak minősül.
                </p>
              </div>
              <div className="space-y-4 p-5 text-sm">
                {responseType === "accept_all" && !showOtherDecisions ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2.5 text-sm text-emerald-950">
                    <CheckCircle2 className="mr-1.5 inline h-4 w-4" />
                    Elfogadja az összes szakágot ({pkg.snapshots.length} db ·{" "}
                    {formatHuf(pkg.grossTotal)} bruttó).
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {(
                      [
                        ["accept_all", "Elfogadom minden szakágot"],
                        ["partial", "Csak kiválasztott szakágakat fogadom el"],
                        ["reject_all", "Elutasítom az ajánlatot"],
                      ] as const
                    ).map(([type, label]) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setResponseType(type)}
                        className={cn(
                          "rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                          responseType === type
                            ? "border-blue-500 bg-blue-50 font-semibold text-blue-950"
                            : "border-slate-200 hover:bg-slate-50"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}

                {!showOtherDecisions && responseType === "accept_all" ? (
                  <button
                    type="button"
                    className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-slate-900"
                    onClick={() => setShowOtherDecisions(true)}
                  >
                    Más döntés…
                    <ChevronDown className="ml-1 h-4 w-4" />
                  </button>
                ) : null}

                {responseType === "partial" ? (
                  <div className="space-y-2 rounded-lg border border-slate-200 p-3">
                    <Label>Elfogadott szakágak</Label>
                    {pkg.snapshots.map((snap) => (
                      <label
                        key={snap.quoteId}
                        className="flex cursor-pointer items-center gap-2"
                      >
                        <Checkbox
                          checked={acceptedQuoteIds.includes(snap.quoteId)}
                          onCheckedChange={(v) => {
                            setAcceptedQuoteIds((prev) =>
                              v === true
                                ? [...new Set([...prev, snap.quoteId])]
                                : prev.filter((id) => id !== snap.quoteId)
                            )
                          }}
                        />
                        <span className="min-w-0 flex-1">{snap.quoteTitle}</span>
                        <span className="tabular-nums text-slate-700">
                          {formatHuf(snap.grossTotal)}
                        </span>
                      </label>
                    ))}
                  </div>
                ) : null}

                <div>
                  <Label htmlFor="client-name">Neved *</Label>
                  <Input
                    id="client-name"
                    className="mt-1"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Pl. Kiss András"
                  />
                </div>

                <div>
                  <Label htmlFor="client-notes-pub">Megjegyzés (opcionális)</Label>
                  <Textarea
                    id="client-notes-pub"
                    className="mt-1 min-h-[72px]"
                    value={clientNotes}
                    onChange={(e) => setClientNotes(e.target.value)}
                  />
                </div>

                <label className="flex cursor-pointer items-start gap-2">
                  <Checkbox
                    checked={confirm}
                    onCheckedChange={(v) => setConfirm(v === true)}
                  />
                  <span className="text-sm leading-snug text-slate-700">
                    Az ajánlat tartalmát megismertem, és a fenti döntést
                    meghoztam.
                  </span>
                </label>

                <Button
                  className="h-11 w-full text-base sm:w-auto"
                  variant={
                    responseType === "reject_all" ? "destructive" : "default"
                  }
                  onClick={() => void handleSubmit()}
                  disabled={submitting}
                >
                  {submitting ? "Küldés…" : submitLabel}
                </Button>
              </div>
            </section>
          ) : null}

          {pkg.status === "accepted" && pkg.respondedAt ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
              Elfogadva: {formatDate(pkg.respondedAt)}
              {pkg.respondedByName ? ` · ${pkg.respondedByName}` : null}
              {pkg.clientNotes ? ` — ${pkg.clientNotes}` : null}
            </div>
          ) : null}

          {pkg.status === "rejected" && pkg.respondedAt ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
              Elutasítva: {formatDate(pkg.respondedAt)}
              {pkg.clientNotes ? ` — ${pkg.clientNotes}` : null}
            </div>
          ) : null}
        </>
      )}

      {pdfModel ? (
        <div className="offer-pdf-doc pointer-events-none fixed left-[-10000px] top-0 w-[210mm] opacity-0">
          <QuoteExportDocument model={pdfModel} />
        </div>
      ) : null}
    </div>
  )
}
