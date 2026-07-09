"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import type { CustomerPackage, CustomerPackageSnapshot, Project } from "@/types/projects"
import { formatHuf } from "@/lib/pricing"
import {
  CUSTOMER_PACKAGE_STATUS_LABELS,
  type CustomerPackageResponseType,
} from "@/lib/customer-package"
import { getTradeLabel } from "@/lib/trades"
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
  project: Project | null
}

type OfferMeta = {
  needsCode: true
  status: CustomerPackage["status"]
  expiresAt: string | null
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
          <h3 className="text-base font-semibold text-slate-900">{getTradeLabel(snap.trade)}</h3>
          <p className="mt-0.5 text-sm text-slate-600">{snap.quoteTitle}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Bruttó</p>
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
          <table className="w-full min-w-[36rem] border-collapse text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-2.5 text-left">Tétel</th>
                <th className="px-3 py-2.5 text-right">Menny.</th>
                <th className="px-3 py-2.5 text-right">Egységár</th>
                <th className="px-4 py-2.5 text-right">Nettó</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.lineId} className="border-b border-slate-100">
                  <td className="px-4 py-2.5 align-top">
                    <p className="font-medium leading-snug text-slate-900">{line.text}</p>
                    {line.identifier ? (
                      <p className="mt-0.5 text-xs text-slate-500">{line.identifier}</p>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-slate-700">
                    {line.quantity} {line.unitLabel}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-slate-800">
                    {formatHuf(line.sellNetUnitPrice)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums font-semibold text-slate-900">
                    {formatHuf(line.sellNetTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-5 py-4 text-sm text-slate-600">Összesített szakág-ajánlat (részletes tétellista nem érhető el).</p>
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
  const [unlocked, setUnlocked] = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const [responseType, setResponseType] = useState<CustomerPackageResponseType>("accept_all")
  const [acceptedQuoteIds, setAcceptedQuoteIds] = useState<string[]>([])
  const [clientName, setClientName] = useState("")
  const [clientNotes, setClientNotes] = useState("")
  const [confirm, setConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/offer/${token}`)
      if (!res.ok) {
        setError(res.status === 404 ? "Az ajánlat-link nem található." : "Nem sikerült betölteni.")
        return
      }
      const json = (await res.json()) as OfferPayload | OfferMeta
      if ("needsCode" in json && json.needsCode) {
        setMeta(json)
        return
      }
      const payload = json as OfferPayload
      setData(payload)
      setUnlocked(true)
      setAcceptedQuoteIds(payload.package.snapshots.map((s) => s.quoteId))
    } catch {
      setError("Hálózati hiba — próbáld újra később.")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  const pkg = data?.package
  const project = data?.project

  const expired = useMemo(() => {
    const expiresAt = pkg?.expiresAt ?? meta?.expiresAt
    if (!expiresAt) return false
    return new Date(expiresAt).getTime() < Date.now()
  }, [pkg, meta])

  const canDecide = pkg?.status === "sent" && !expired && unlocked

  const handleUnlock = async () => {
    const code = accessCode.trim()
    if (!code) return
    setUnlocking(true)
    try {
      const res = await fetch(`/api/offer/${token}?code=${encodeURIComponent(code)}`)
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? "Hibás belépőkód")
        return
      }
      const payload = json as OfferPayload
      setData(payload)
      setUnlocked(true)
      setAcceptedQuoteIds(payload.package.snapshots.map((s) => s.quoteId))
    } catch {
      toast.error("Hálózati hiba")
    } finally {
      setUnlocking(false)
    }
  }

  const handleSubmit = async () => {
    if (!pkg || !canDecide) return
    if (!clientName.trim()) {
      toast.error("Add meg a neved")
      return
    }
    if (!confirm) {
      toast.error("Erősítsd meg az elfogadást")
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
          acceptedQuoteIds: responseType === "partial" ? acceptedQuoteIds : undefined,
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
      setData({ package: json.package as CustomerPackage, project: project ?? null })
    } catch {
      toast.error("Hálózati hiba")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <p className="p-6 text-center text-sm text-slate-600">Ajánlat betöltése…</p>
  }

  if (!pkg && meta?.needsCode) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-6">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Belépőkód</h2>
          <p className="mt-1 text-sm text-slate-600">
            Az ajánlat megtekintéséhez add meg a kapott 6 jegyű kódot.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Input
              className="max-w-[10rem] font-mono text-lg tracking-widest"
              inputMode="numeric"
              maxLength={6}
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleUnlock()
              }}
              placeholder="••••••"
            />
            <Button onClick={() => void handleUnlock()} disabled={unlocking}>
              {unlocking ? "Ellenőrzés…" : "Megnyitás"}
            </Button>
          </div>
          {meta.status === "superseded" ? (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              Ezt az ajánlatot egy újabb verzió váltotta fel — döntés nem rögzíthető.
            </p>
          ) : null}
          {expired && meta.status === "sent" ? (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              Az ajánlat érvényessége lejárt. Kérj frissített ajánlatot a kivitelezőtől.
            </p>
          ) : null}
        </section>
      </div>
    )
  }

  if (error || !pkg) {
    return (
      <div className="mx-auto max-w-lg p-6 text-center">
        <p className="text-sm font-medium text-slate-800">{error ?? "Ismeretlen hiba"}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 pb-10 sm:p-6">
      <section className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="border-b border-slate-100 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Projektajánlat
          </p>
          <h1 className="mt-1 text-xl font-bold text-slate-950 sm:text-2xl">{pkg.title}</h1>
          {project ? (
            <p className="mt-1 text-sm text-slate-600">
              {project.clientName} · {project.siteAddress}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <span
              className={cn(
                "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                pkg.status === "sent" && "bg-blue-100 text-blue-950",
                pkg.status === "accepted" && "bg-emerald-100 text-emerald-950",
                pkg.status === "rejected" && "bg-red-100 text-red-900",
                pkg.status === "superseded" && "bg-slate-200 text-slate-700"
              )}
            >
              {CUSTOMER_PACKAGE_STATUS_LABELS[pkg.status]}
            </span>
            <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
              Elküldve: {formatDate(pkg.sentAt)}
            </span>
            {pkg.expiresAt ? (
              <span
                className={cn(
                  "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                  expired ? "bg-amber-100 text-amber-950" : "bg-slate-100 text-slate-700"
                )}
              >
                Érvényes: {formatDate(pkg.expiresAt)}
              </span>
            ) : null}
          </div>
          {pkg.notes ? (
            <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{pkg.notes}</p>
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
            <p className="mt-1 text-sm text-slate-600">Nettó {formatHuf(pkg.sellNetTotal)}</p>
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
          Az ajánlat érvényessége lejárt. Kérj frissített ajánlatot a kivitelezőtől.
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
                <h2 className="text-base font-semibold text-slate-900">Válasz az ajánlatra</h2>
                <p className="mt-0.5 text-sm text-slate-600">
                  A rögzítés írásbeli elfogadásnak minősül.
                </p>
              </div>
              <div className="space-y-4 p-5 text-sm">
                <div className="grid gap-2">
                  {(
                    [
                      ["accept_all", "Elfogadom minden szakágot"],
                      ["partial", "Csak kiválasztott szakágokat fogadom el"],
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

                {responseType === "partial" ? (
                  <div className="space-y-2 rounded-lg border border-slate-200 p-3">
                    <Label>Elfogadott szakágok</Label>
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
                  <Checkbox checked={confirm} onCheckedChange={(v) => setConfirm(v === true)} />
                  <span className="text-sm leading-snug text-slate-700">
                    Az ajánlat tartalmát megismertem, és a fenti döntést meghoztam.
                  </span>
                </label>

                <Button
                  className="w-full sm:w-auto"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? "Küldés…" : "Válasz elküldése"}
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
    </div>
  )
}
