"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, ChevronRight, Clock, XCircle } from "lucide-react"
import type {
  Project,
  RfqCampaign,
  RfqInvitation,
  SubcontractorRfq,
  SubcontractorRfqSubmission,
} from "@/types/projects"
import { RFQ_INVITATION_STATUS_LABELS } from "@/lib/project-labels"
import { formatHuf } from "@/lib/pricing"
import { getBidLineTotal } from "@/lib/rfq-migration"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { FolderOpen } from "lucide-react"
import { cn } from "@/lib/utils"

type RfqPublicClientProps = {
  token: string
}

type LineBidForm = {
  materialUnitPrice: number
  laborUnitPrice: number
  declined: boolean
}

function codeStorageKey(token: string) {
  return `rfq-code:${token}`
}

function emptyBids(rfq: SubcontractorRfq): Record<string, LineBidForm> {
  const out: Record<string, LineBidForm> = {}
  for (const line of rfq.lines) {
    out[line.id] = { materialUnitPrice: 0, laborUnitPrice: 0, declined: false }
  }
  return out
}

function bidsFromSubmission(
  rfq: SubcontractorRfq,
  submission: SubcontractorRfqSubmission
): Record<string, LineBidForm> {
  const out = emptyBids(rfq)
  for (const bid of submission.lineBids) {
    out[bid.rfqLineId] = {
      materialUnitPrice: bid.materialUnitPrice ?? 0,
      laborUnitPrice: bid.laborUnitPrice ?? bid.unitPrice ?? 0,
      declined: bid.declined ?? false,
    }
  }
  return out
}

export function RfqPublicClient({ token }: RfqPublicClientProps) {
  const [loading, setLoading] = useState(true)
  const [invitation, setInvitation] = useState<RfqInvitation | null>(null)
  const [rfq, setRfq] = useState<SubcontractorRfq | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [campaign, setCampaign] = useState<RfqCampaign | null>(null)
  const [existingSubmission, setExistingSubmission] = useState<SubcontractorRfqSubmission | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [inviteeName, setInviteeName] = useState<string | null>(null)
  const [units, setUnits] = useState<Record<string, string>>({})
  const [codeInput, setCodeInput] = useState("")
  const [codeError, setCodeError] = useState<string | null>(null)
  const [unlocking, setUnlocking] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    subcontractorName: "",
    contactPhone: "",
    notes: "",
    lineBids: {} as Record<string, LineBidForm>,
  })

  /** Szerveroldali PIN — kód nélkül csak minimális infó jön, kóddal a teljes csomag */
  const loadData = async (code: string): Promise<boolean> => {
    const url = code
      ? `/api/rfq/${token}?code=${encodeURIComponent(code)}`
      : `/api/rfq/${token}`
    const res = await fetch(url)
    if (!res.ok) {
      if (code) {
        const json = await res.json().catch(() => ({}))
        setCodeError(
          res.status === 429
            ? "Túl sok hibás kód — próbálja 15 perc múlva."
            : ((json as { error?: string }).error ?? "Hibás kód. Ellenőrizze és próbálja újra.")
        )
        sessionStorage.removeItem(codeStorageKey(token))
        return false
      }
      setNotFound(true)
      return false
    }
    const data = (await res.json()) as
      | { needsCode: true; subcontractorName: string }
      | {
          invitation: RfqInvitation
          rfq: SubcontractorRfq
          project: Project
          submission: SubcontractorRfqSubmission | null
          campaign: RfqCampaign | null
          units: Record<string, string>
        }

    if ("needsCode" in data) {
      setInviteeName(data.subcontractorName)
      return false
    }

    setInvitation(data.invitation)
    setRfq(data.rfq)
    setProject(data.project)
    setCampaign(data.campaign)
    setExistingSubmission(data.submission)
    setUnits(data.units ?? {})
    if (data.submission) {
      setForm({
        subcontractorName: data.submission.subcontractorName,
        contactPhone: data.submission.contactPhone,
        notes: data.submission.notes,
        lineBids: bidsFromSubmission(data.rfq, data.submission),
      })
    } else {
      setForm((f) => ({
        ...f,
        subcontractorName: data.invitation.subcontractorName,
        contactPhone: data.invitation.contactPhone,
        lineBids: emptyBids(data.rfq),
      }))
    }
    return true
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const savedCode = sessionStorage.getItem(codeStorageKey(token)) ?? ""
        if (savedCode) setCodeInput(savedCode)
        await loadData(savedCode)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, submitted])

  const totalAmount = useMemo(() => {
    if (!rfq) return 0
    return rfq.lines.reduce((sum, line) => {
      const bid = form.lineBids[line.id]
      if (!bid || bid.declined) return sum
      return sum + getBidLineTotal(
        {
          rfqLineId: line.id,
          materialUnitPrice: bid.materialUnitPrice,
          laborUnitPrice: bid.laborUnitPrice,
          declined: false,
        },
        line.quantity
      )
    }, 0)
  }, [rfq, form.lineBids])

  const pricedCount = useMemo(() => {
    if (!rfq) return 0
    return rfq.lines.filter((l) => {
      const b = form.lineBids[l.id]
      return b && !b.declined && (b.materialUnitPrice > 0 || b.laborUnitPrice > 0)
    }).length
  }, [rfq, form.lineBids])

  const canEdit = invitation && !["accepted", "rejected"].includes(invitation.status)
  const showForm = canEdit && (editing || !existingSubmission)

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-slate-600">Betöltés…</p>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Érvénytelen link</h1>
        <p className="mt-3 text-sm text-slate-600">
          Az ajánlatkérés nem található. Kérje az építésvezetőtől az új linket.
        </p>
      </div>
    )
  }

  const tryUnlock = async () => {
    const code = codeInput.trim()
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

  if (!rfq || !invitation) {
    return (
      <div className="mx-auto max-w-sm px-4 py-12 sm:py-16">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold">Ajánlat beküldése</h1>
          <p className="mt-2 text-sm text-slate-600">
            Üdvözöljük{inviteeName ? <>, <strong>{inviteeName}</strong></> : null}! Írja be a{" "}
            <strong>6 számjegyű kódot</strong>.
          </p>
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-base">Hozzáférési kód</Label>
              <Input
                value={codeInput}
                onChange={(e) => {
                  setCodeInput(e.target.value)
                  setCodeError(null)
                }}
                placeholder="pl. 123456"
                inputMode="numeric"
                className="h-12 text-center text-lg tracking-widest"
                maxLength={6}
                onKeyDown={(e) => e.key === "Enter" && void tryUnlock()}
              />
              {codeError ? <p className="text-sm text-red-600">{codeError}</p> : null}
            </div>
            <Button
              className="h-12 w-full text-base"
              onClick={() => void tryUnlock()}
              disabled={unlocking}
            >
              {unlocking ? "Ellenőrzés…" : "Tovább"}
              <ChevronRight className="ml-1 h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const expired = new Date(rfq.expiresAt) < new Date()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.subcontractorName.trim()) return
    if (pricedCount === 0) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/rfq/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessCode: codeInput.trim(),
          subcontractorName: form.subcontractorName.trim(),
          contactEmail: "",
          contactPhone: form.contactPhone.trim(),
          notes: form.notes.trim(),
          lineBids: rfq.lines.map((line) => {
            const b = form.lineBids[line.id] ?? {
              materialUnitPrice: 0,
              laborUnitPrice: 0,
              declined: false,
            }
            return {
              rfqLineId: line.id,
              materialUnitPrice: b.declined ? 0 : b.materialUnitPrice,
              laborUnitPrice: b.declined ? 0 : b.laborUnitPrice,
              declined: b.declined,
            }
          }),
          totalAmount: Math.round(totalAmount),
        }),
      })
      if (res.ok) {
        setSubmitted(true)
        setEditing(false)
        await loadData(codeInput.trim())
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (expired) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Lejárt ajánlatkérés</h1>
        <p className="mt-3 text-sm text-slate-600">
          Határidő: {new Date(rfq.expiresAt).toLocaleDateString("hu-HU")}
        </p>
      </div>
    )
  }

  const statusLabel = RFQ_INVITATION_STATUS_LABELS[invitation.status]

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:py-8">
      <div className="mb-6 rounded-xl border bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-blue-700">Árajánlat kérés</p>
        <h1 className="mt-1 text-xl font-semibold leading-snug">{rfq.title}</h1>
        <p className="mt-2 text-sm font-medium text-slate-800">{invitation.subcontractorName}</p>
        {project ? (
          <p className="mt-2 text-sm text-slate-600">
            <span className="font-medium">Munkahely:</span> {project.name}
            {project.siteAddress ? ` — ${project.siteAddress}` : ""}
          </p>
        ) : null}
        <p className="mt-2 text-sm text-slate-600">
          Határidő: <strong>{new Date(rfq.expiresAt).toLocaleDateString("hu-HU")}</strong>
        </p>

        <div
          className={cn(
            "mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
            invitation.status === "accepted" && "bg-emerald-50 text-emerald-900",
            invitation.status === "rejected" && "bg-slate-100 text-slate-700",
            invitation.status === "submitted" && "bg-blue-50 text-blue-900",
            invitation.status === "invited" && "bg-amber-50 text-amber-900"
          )}
        >
          {invitation.status === "accepted" ? (
            <CheckCircle2 className="h-5 w-5 shrink-0" />
          ) : invitation.status === "rejected" ? (
            <XCircle className="h-5 w-5 shrink-0" />
          ) : (
            <Clock className="h-5 w-5 shrink-0" />
          )}
          <span>Státusz: {statusLabel}</span>
        </div>

        {existingSubmission && !showForm ? (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-slate-600">
              Beküldve:{" "}
              {new Date(existingSubmission.updatedAt).toLocaleString("hu-HU")}
            </p>
            <p className="text-lg font-bold text-slate-900">
              Összesen: {formatHuf(existingSubmission.totalAmount)}
            </p>
            {canEdit ? (
              <Button type="button" variant="outline" onClick={() => setEditing(true)}>
                Ajánlat módosítása
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {campaign?.message ? (
        <div className="mb-4 rounded-xl border bg-slate-50 px-4 py-3 text-sm text-slate-800">
          <p className="font-medium text-slate-900">Üzenet az építésvezetőtől</p>
          <p className="mt-1 whitespace-pre-wrap">{campaign.message}</p>
        </div>
      ) : null}

      {campaign && campaign.attachedFolderSnapshots.length > 0 ? (
        <div className="mb-4 rounded-xl border bg-white px-4 py-3 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Mellékelt dokumentumok</p>
          <ul className="mt-2 space-y-1.5">
            {campaign.attachedFolderSnapshots.map((folder) => (
              <li
                key={folder.folderId}
                className="flex items-center gap-2 text-sm text-slate-700"
              >
                <FolderOpen className="h-4 w-4 shrink-0 text-slate-500" />
                <span>
                  {folder.name}
                  <span className="text-slate-500"> · {folder.fileCount} fájl</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">
            A fájlok letöltése hamarosan elérhető — egyelőre az építésvezető külön is megküldheti.
          </p>
        </div>
      ) : null}

      {showForm ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            Töltse ki az <strong>anyag</strong> és <strong>díj</strong> egységárát (Ft), vagy jelölje
            „Nem vállalom”. Részleges ajánlat is küldhető.
          </div>

          <div className="space-y-3">
            {rfq.lines.map((line, index) => {
              const bid = form.lineBids[line.id] ?? {
                materialUnitPrice: 0,
                laborUnitPrice: 0,
                declined: false,
              }
              const lineTotal = bid.declined
                ? 0
                : getBidLineTotal(
                    {
                      rfqLineId: line.id,
                      materialUnitPrice: bid.materialUnitPrice,
                      laborUnitPrice: bid.laborUnitPrice,
                      declined: false,
                    },
                    line.quantity
                  )

              return (
                <div
                  key={line.id}
                  className={cn(
                    "rounded-xl border bg-white p-4 shadow-sm",
                    bid.declined ? "border-slate-200 bg-slate-50" : "border-slate-200"
                  )}
                >
                  <div className="mb-3">
                    <span className="text-sm font-medium text-slate-500">#{index + 1}</span>
                    <p className="mt-0.5 text-sm font-medium leading-snug text-slate-900">
                      {line.text}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {line.quantity} {units[line.unitId] ?? ""}
                    </p>
                  </div>

                  <label className="mb-3 flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={bid.declined}
                      onCheckedChange={(v) =>
                        setForm((f) => ({
                          ...f,
                          lineBids: {
                            ...f.lineBids,
                            [line.id]: { ...bid, declined: v === true },
                          },
                        }))
                      }
                    />
                    Nem vállalom ezt a tételt
                  </label>

                  {!bid.declined ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-sm">Anyag egységár (Ft)</Label>
                        <Input
                          type="number"
                          min={0}
                          className="h-11 text-base"
                          value={bid.materialUnitPrice || ""}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              lineBids: {
                                ...f.lineBids,
                                [line.id]: {
                                  ...bid,
                                  materialUnitPrice: Number(e.target.value) || 0,
                                },
                              },
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm">Díj egységár (Ft)</Label>
                        <Input
                          type="number"
                          min={0}
                          className="h-11 text-base"
                          value={bid.laborUnitPrice || ""}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              lineBids: {
                                ...f.lineBids,
                                [line.id]: {
                                  ...bid,
                                  laborUnitPrice: Number(e.target.value) || 0,
                                },
                              },
                            }))
                          }
                        />
                      </div>
                    </div>
                  ) : null}

                  {!bid.declined && lineTotal > 0 ? (
                    <p className="mt-2 text-right text-sm font-semibold">
                      Sor összesen: {formatHuf(lineTotal)}
                    </p>
                  ) : null}
                </div>
              )
            })}
          </div>

          <div className="sticky bottom-0 rounded-xl border bg-white p-4 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm text-slate-600">
                Árazott: {pricedCount} / {rfq.lines.length}
              </span>
              <span className="text-lg font-bold">{formatHuf(Math.round(totalAmount))}</span>
            </div>

            <div className="mb-4 space-y-3 border-t pt-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Cége / neve *</Label>
                <Input
                  className="h-11"
                  value={form.subcontractorName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, subcontractorName: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Telefon</Label>
                <Input
                  className="h-11"
                  type="tel"
                  value={form.contactPhone}
                  onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Megjegyzés</Label>
                <Textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              className="h-12 w-full text-base"
              disabled={submitting || pricedCount === 0}
            >
              {submitting ? "Küldés…" : existingSubmission ? "Ajánlat frissítése" : "Ajánlat beküldése"}
            </Button>
          </div>
        </form>
      ) : existingSubmission ? (
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="ea-label mb-3">Beküldött tételek</h2>
          <ul className="space-y-2 text-sm">
            {rfq.lines.map((line) => {
              const bid = existingSubmission.lineBids.find((b) => b.rfqLineId === line.id)
              if (!bid || bid.declined) {
                return (
                  <li key={line.id} className="text-slate-500">
                    {line.text} — <em>nem vállalva</em>
                  </li>
                )
              }
              return (
                <li key={line.id} className="flex justify-between gap-2">
                  <span className="text-slate-800">{line.text}</span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {formatHuf(getBidLineTotal(bid, line.quantity))}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      {submitted ? (
        <p className="mt-4 text-center text-sm text-emerald-700">Ajánlat sikeresen mentve.</p>
      ) : null}
    </div>
  )
}
