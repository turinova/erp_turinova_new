"use client"

import { useEffect, useMemo, useState } from "react"
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  FileDown,
  FileSpreadsheet,
  FolderOpen,
  Pencil,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import type {
  RfqCampaign,
  RfqInvitation,
  SubcontractorRfq,
  SubcontractorRfqSubmission,
} from "@/types/projects"
import { QUOTE_EXCEL_COLUMNS as COL } from "@/lib/quote-columns"
import { formatHuf } from "@/lib/pricing"
import { getBidLineTotal } from "@/lib/rfq-migration"
import { getTradeLabel } from "@/lib/trades"
import {
  buildRfqPublicExportModel,
} from "@/lib/rfq-public-export/build-export-model"
import { downloadRfqPublicExcel } from "@/lib/rfq-public-export/build-workbook"
import { printRfqPublicPdfDocument } from "@/lib/rfq-public-export/pdf-print"
import { RfqPublicExportDocument } from "@/components/rfq/rfq-public-export-document"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

type RfqPublicClientProps = {
  token: string
}

type PublicProject = {
  id: string
  name: string
  siteAddress: string
  code: string
}

type LineBidForm = {
  materialUnitPrice: number
  laborUnitPrice: number
  declined: boolean
}

type TimelineEvent = {
  id: string
  at: string
  title: string
  detail?: string
  tone: "neutral" | "success" | "warning" | "danger"
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

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("hu-HU", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function statusSentence(input: {
  expired: boolean
  packageDecided: boolean
  youWon: boolean
  youLost: boolean
  hasSubmission: boolean
  /** Több szakág progress — felülírja az egy-csomagos „beküldve” mondatot */
  multi?: {
    total: number
    done: number
    missingLabels: string[]
  } | null
}): { text: string; tone: "amber" | "blue" | "emerald" | "slate" | "red" } {
  if (input.youWon) {
    return { text: "Te nyertél — a vállalásod elfogadva.", tone: "emerald" }
  }
  if (input.youLost) {
    return {
      text: "Most nem téged választottak erre a csomagra.",
      tone: "slate",
    }
  }
  if (input.expired) {
    return {
      text: input.hasSubmission
        ? "Lejárt a határidő — az ajánlatod beérkezett, döntésre vársz vagy lezárták."
        : "Lejárt a határidő — új ajánlatot már nem lehet beküldeni.",
      tone: "red",
    }
  }
  if (input.packageDecided) {
    return { text: "A döntés megszületett.", tone: "slate" }
  }

  const multi = input.multi
  if (multi && multi.total > 1) {
    if (multi.done === 0) {
      return {
        text: `${multi.total} szakág vár ajánlatra — mindegyiket külön kell beküldeni.`,
        tone: "amber",
      }
    }
    if (multi.done < multi.total) {
      const missing = multi.missingLabels.slice(0, 3).join(", ")
      const more =
        multi.missingLabels.length > 3
          ? ` +${multi.missingLabels.length - 3}`
          : ""
      return {
        text: `${multi.total}-ból ${multi.done} szakág beküldve — még hiányzik: ${missing}${more}.`,
        tone: "amber",
      }
    }
    return {
      text: `Mind a ${multi.total} szakág beküldve — döntésre vársz.`,
      tone: "blue",
    }
  }

  if (input.hasSubmission) {
    return { text: "Ajánlatod beérkezett — döntésre vár.", tone: "blue" }
  }
  return { text: "Várjuk az ajánlatodat.", tone: "amber" }
}

function packageTradeLabel(pkg: { rfq: SubcontractorRfq }): string {
  const title = pkg.rfq.title?.trim()
  if (title) return title
  return getTradeLabel(pkg.rfq.trade)
}

function buildTimeline(input: {
  invitation: RfqInvitation
  submission: SubcontractorRfqSubmission | null
  decidedAt: string | null
  youWon: boolean
  youLost: boolean
}): TimelineEvent[] {
  const events: TimelineEvent[] = []

  events.push({
    id: "invited",
    at: input.invitation.createdAt,
    title: "Meghívó megérkezett",
    detail: "Árajánlatkérés link + belépő kód",
    tone: "neutral",
  })

  if (input.submission) {
    const history = [...(input.submission.revisionHistory ?? [])].sort(
      (a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
    )
    const firstTotal = history[0]?.totalAmount ?? input.submission.totalAmount
    events.push({
      id: "submitted",
      at: input.submission.submittedAt,
      title: "Ajánlat beküldve",
      detail: formatHuf(firstTotal),
      tone: "success",
    })

    const revised =
      new Date(input.submission.updatedAt).getTime() >
      new Date(input.submission.submittedAt).getTime()
    if (revised) {
      const revCount = Math.max(1, history.length)
      events.push({
        id: "updated",
        at: input.submission.updatedAt,
        title:
          revCount > 1
            ? `Módosított ajánlat (${revCount}. változat)`
            : "Módosított ajánlat",
        detail: formatHuf(input.submission.totalAmount),
        tone: "success",
      })
    }
  }

  if (input.decidedAt && (input.youWon || input.youLost)) {
    events.push({
      id: "decision",
      at: input.decidedAt,
      title: input.youWon ? "Döntés: te nyertél" : "Döntés: most nem téged választottak",
      tone: input.youWon ? "success" : "warning",
    })
  }

  return events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
}

export function RfqPublicClient({ token }: RfqPublicClientProps) {
  const [loading, setLoading] = useState(true)
  const [invitation, setInvitation] = useState<RfqInvitation | null>(null)
  const [rfq, setRfq] = useState<SubcontractorRfq | null>(null)
  const [project, setProject] = useState<PublicProject | null>(null)
  const [campaign, setCampaign] = useState<RfqCampaign | null>(null)
  const [existingSubmission, setExistingSubmission] =
    useState<SubcontractorRfqSubmission | null>(null)
  const [packageDecided, setPackageDecided] = useState(false)
  const [youWon, setYouWon] = useState(false)
  const [youLost, setYouLost] = useState(false)
  const [decidedAt, setDecidedAt] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [inviteeName, setInviteeName] = useState<string | null>(null)
  const [units, setUnits] = useState<Record<string, string>>({})
  const [exportPackages, setExportPackages] = useState<
    Array<{
      rfq: SubcontractorRfq
      submission: SubcontractorRfqSubmission | null
      invitationId: string
      invitationStatus: string
      isCurrent: boolean
    }>
  >([])
  const [activeInvitationId, setActiveInvitationId] = useState<string | null>(null)
  const [codeInput, setCodeInput] = useState("")
  const [codeError, setCodeError] = useState<string | null>(null)
  const [unlocking, setUnlocking] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [saveFlash, setSaveFlash] = useState<string | null>(null)
  const [exportingExcel, setExportingExcel] = useState(false)
  const [form, setForm] = useState({
    subcontractorName: "",
    contactPhone: "",
    contactEmail: "",
    notes: "",
    lineBids: {} as Record<string, LineBidForm>,
  })

  type ExportPkg = {
    rfq: SubcontractorRfq
    submission: SubcontractorRfqSubmission | null
    invitationId: string
    invitationStatus: string
    isCurrent: boolean
  }

  const applyPackageView = (
    pkg: ExportPkg,
    invite: RfqInvitation,
    opts?: { keepContact?: boolean }
  ) => {
    setActiveInvitationId(pkg.invitationId)
    setRfq(pkg.rfq)
    setExistingSubmission(pkg.submission)
    setEditing(false)
    setSubmitError(null)
    applyLockState(pkg)
    if (pkg.submission) {
      setForm({
        subcontractorName: pkg.submission.subcontractorName,
        contactPhone: pkg.submission.contactPhone,
        contactEmail: pkg.submission.contactEmail ?? "",
        notes: pkg.submission.notes,
        lineBids: bidsFromSubmission(pkg.rfq, pkg.submission),
      })
    } else {
      setForm((f) => ({
        ...f,
        subcontractorName: opts?.keepContact
          ? f.subcontractorName || invite.subcontractorName
          : invite.subcontractorName,
        contactPhone: opts?.keepContact
          ? f.contactPhone || invite.contactPhone
          : invite.contactPhone,
        contactEmail: opts?.keepContact ? f.contactEmail : f.contactEmail || "",
        notes: "",
        lineBids: emptyBids(pkg.rfq),
      }))
    }
  }

  const loadData = async (
    code: string,
    opts?: {
      advanceToNextIncomplete?: boolean
      afterInvitationId?: string
    }
  ): Promise<boolean> => {
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
          project: PublicProject | null
          submission: SubcontractorRfqSubmission | null
          campaign: RfqCampaign | null
          units: Record<string, string>
          exportPackages?: Array<{
            rfq: SubcontractorRfq
            submission: SubcontractorRfqSubmission | null
            invitationId: string
            invitationStatus?: string
            isCurrent: boolean
          }>
          packageDecided: boolean
          youWon: boolean
          youLost: boolean
          decidedAt: string | null
        }

    if ("needsCode" in data) {
      setInviteeName(data.subcontractorName)
      return false
    }

    setInvitation(data.invitation)
    setProject(data.project)
    setCampaign(data.campaign)
    setUnits(data.units ?? {})
    const packages =
      data.exportPackages?.length
        ? data.exportPackages.map((p) => ({
            ...p,
            invitationId: p.invitationId ?? data.invitation.id,
            invitationStatus:
              p.invitationStatus ??
              (p.isCurrent ? data.invitation.status : "pending"),
          }))
        : [
            {
              rfq: data.rfq,
              submission: data.submission,
              invitationId: data.invitation.id,
              invitationStatus: data.invitation.status,
              isCurrent: true,
            },
          ]
    setExportPackages(packages)

    const afterId = opts?.afterInvitationId
    let preferredId: string
    if (opts?.advanceToNextIncomplete) {
      const nextIncomplete = packages.find((p) => !p.submission)
      preferredId =
        nextIncomplete?.invitationId ??
        afterId ??
        packages.find((p) => p.isCurrent)?.invitationId ??
        data.invitation.id
    } else {
      preferredId =
        (activeInvitationId &&
          packages.some((p) => p.invitationId === activeInvitationId) &&
          activeInvitationId) ||
        packages.find((p) => p.isCurrent)?.invitationId ||
        data.invitation.id
    }
    const active =
      packages.find((p) => p.invitationId === preferredId) ?? packages[0]

    applyPackageView(active, data.invitation, { keepContact: true })
    setDecidedAt(data.decidedAt ?? null)
    return true
  }

  function applyLockState(pkg: {
    rfq: SubcontractorRfq
    invitationStatus: string
  }) {
    const decided = pkg.rfq.status === "decided"
    setPackageDecided(decided)
    setYouWon(pkg.invitationStatus === "accepted")
    setYouLost(
      pkg.invitationStatus === "rejected" ||
        (decided && pkg.invitationStatus !== "accepted")
    )
  }

  function selectTrade(invitationId: string) {
    const pkg = exportPackages.find((p) => p.invitationId === invitationId)
    if (!pkg || !invitation) return
    applyPackageView(pkg, invitation, { keepContact: true })
    requestAnimationFrame(() => {
      document.getElementById("ajanlat")?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
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
  }, [token])

  const totalAmount = useMemo(() => {
    if (!rfq) return 0
    return rfq.lines.reduce((sum, line) => {
      const bid = form.lineBids[line.id]
      if (!bid || bid.declined) return sum
      return (
        sum +
        getBidLineTotal(
          {
            rfqLineId: line.id,
            materialUnitPrice: bid.materialUnitPrice,
            laborUnitPrice: bid.laborUnitPrice,
            declined: false,
          },
          line.quantity
        )
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

  const expired = rfq ? new Date(rfq.expiresAt) < new Date() : false
  const lockedByDecision = youWon || youLost || packageDecided
  const canEdit = Boolean(invitation && !lockedByDecision && !expired)
  const showForm = canEdit && (editing || !existingSubmission)

  const multiTrade = useMemo(() => {
    if (exportPackages.length <= 1) return null
    const done = exportPackages.filter((p) => p.submission).length
    const missing = exportPackages.filter((p) => !p.submission)
    return {
      total: exportPackages.length,
      done,
      missingLabels: missing.map((p) => packageTradeLabel(p)),
      missing,
      nextIncomplete: missing[0] ?? null,
    }
  }, [exportPackages])

  const status = statusSentence({
    expired,
    packageDecided,
    youWon,
    youLost,
    hasSubmission: Boolean(existingSubmission),
    multi:
      multiTrade && !youWon && !youLost && !packageDecided && !expired
        ? {
            total: multiTrade.total,
            done: multiTrade.done,
            missingLabels: multiTrade.missingLabels,
          }
        : null,
  })

  const timeline = useMemo(() => {
    if (!invitation) return []
    return buildTimeline({
      invitation,
      submission: existingSubmission,
      decidedAt,
      youWon,
      youLost,
    })
  }, [invitation, existingSubmission, decidedAt, youWon, youLost])

  const exportModel = useMemo(() => {
    if (!rfq || !invitation) return null
    const packages =
      exportPackages.length > 0
        ? exportPackages
        : [
            {
              rfq,
              submission: existingSubmission,
              invitationId: invitation.id,
              invitationStatus: invitation.status,
              isCurrent: true,
            },
          ]
    return buildRfqPublicExportModel({
      invitation,
      project,
      submission: existingSubmission,
      units,
      packages,
    })
  }, [rfq, invitation, project, existingSubmission, units, exportPackages])

  const handleExportExcel = async () => {
    if (!exportModel) return
    if (editing && existingSubmission) {
      toast.message("A letöltés az utoljára mentett ajánlatot tartalmazza.")
    }
    setExportingExcel(true)
    try {
      const filename = await downloadRfqPublicExcel(exportModel)
      const tradeCount = exportModel.packages.length
      toast.success(
        exportModel.mode === "offer"
          ? `Ajánlat Excel letöltve (${tradeCount} szakág): ${filename}`
          : `Üres sablon letöltve (${tradeCount} szakág): ${filename}`
      )
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : "Excel export hiba")
    } finally {
      setExportingExcel(false)
    }
  }

  const handleExportPdf = () => {
    if (!exportModel) return
    if (editing && existingSubmission) {
      toast.message("A PDF az utoljára mentett ajánlatot tartalmazza.")
    }
    try {
      const tradeCount = exportModel.packages.length
      printRfqPublicPdfDocument(
        ".rfq-pdf-doc",
        tradeCount > 1
          ? `${exportModel.title} · ${tradeCount} szakág`
          : exportModel.title
      )
      toast.success(
        tradeCount > 1
          ? `PDF megnyitva (${tradeCount} szakág)`
          : "Nyomtatás / PDF mentés megnyitva"
      )
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : "PDF export hiba")
    }
  }

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
        <div className="border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-950">Belépés</h1>
          <p className="mt-2 text-sm text-slate-600">
            Üdvözöljük{inviteeName ? <>, <strong>{inviteeName}</strong></> : null}! Írja be a{" "}
            <strong>6 számjegyű belépő kódot</strong>.
          </p>
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-base">Belépő kód</Label>
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
              {unlocking ? "Ellenőrzés…" : "Belépés"}
              <ChevronRight className="ml-1 h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.subcontractorName.trim()) return
    if (pricedCount === 0) return
    setSubmitError(null)
    setSubmitting(true)
    try {
      const res = await fetch(`/api/rfq/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessCode: codeInput.trim(),
          targetInvitationId: activeInvitationId ?? invitation.id,
          subcontractorName: form.subcontractorName.trim(),
          contactEmail: form.contactEmail.trim(),
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
        setEditing(false)
        const savedId = activeInvitationId ?? invitation.id
        // A loadData a friss listából a következő hiányzó szakágra ugrik
        await loadData(codeInput.trim(), {
          advanceToNextIncomplete: true,
          afterInvitationId: savedId,
        })
        // A toast / flash a következő render exportPackages alapján — számoljuk a mentés előtti állapotból
        const remainingBefore = exportPackages.filter(
          (p) => !p.submission && p.invitationId !== savedId
        )
        if (remainingBefore.length > 0) {
          const nextLabel = packageTradeLabel(remainingBefore[0])
          setSaveFlash(`Mentve. Következő szakág: ${nextLabel}`)
          toast.success(`Mentve — folytasd: ${nextLabel}`)
          requestAnimationFrame(() => {
            document
              .getElementById("ajanlat")
              ?.scrollIntoView({ behavior: "smooth", block: "start" })
          })
        } else {
          setSaveFlash(
            multiTrade && multiTrade.total > 1
              ? "Minden szakág beküldve."
              : "Ajánlat sikeresen mentve."
          )
          toast.success(
            multiTrade && multiTrade.total > 1
              ? "Minden szakág beküldve"
              : "Ajánlat sikeresen mentve"
          )
        }
        setTimeout(() => setSaveFlash(null), 5000)
      } else {
        const json = (await res.json().catch(() => ({}))) as { error?: string }
        if (res.status === 410) setSubmitError("A határidő lejárt — már nem küldhető ajánlat.")
        else if (res.status === 409)
          setSubmitError("Már született döntés — az ajánlat nem módosítható.")
        else setSubmitError(json.error ?? "Nem sikerült menteni.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  const primaryCta = (() => {
    if (!canEdit) return null
    if (showForm) return null
    // Több szakág: ha ez kész, de van hiányzó → elsődleges a következő
    if (
      multiTrade &&
      existingSubmission &&
      multiTrade.nextIncomplete &&
      multiTrade.nextIncomplete.invitationId !== activeInvitationId
    ) {
      const label = packageTradeLabel(multiTrade.nextIncomplete)
      return (
        <Button
          type="button"
          className="h-11 gap-1.5 px-4 text-sm font-semibold"
          onClick={() => selectTrade(multiTrade.nextIncomplete!.invitationId)}
        >
          Következő: {label}
          <ChevronRight className="h-4 w-4" />
        </Button>
      )
    }
    if (existingSubmission) {
      return (
        <Button
          type="button"
          className="h-11 gap-1.5 px-4 text-sm font-semibold"
          variant={multiTrade && multiTrade.done < multiTrade.total ? "outline" : "default"}
          onClick={() => setEditing(true)}
        >
          <Pencil className="h-4 w-4" />
          Módosítás
        </Button>
      )
    }
    return null
  })()

  const exportButtons = (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        className="h-11 gap-1.5 text-sm"
        disabled={!exportModel || exportingExcel}
        title={
          exportModel?.mode === "offer"
            ? "Saját ajánlat Excelben"
            : "Üres ajánlatkérés-sablon Excelben"
        }
        onClick={() => void handleExportExcel()}
      >
        <FileSpreadsheet className="h-4 w-4" />
        {exportingExcel ? "Excel…" : "Excel"}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="h-11 gap-1.5 text-sm"
        disabled={!exportModel}
        title={
          exportModel?.mode === "offer"
            ? "Saját ajánlat PDF / nyomtatás"
            : "Üres ajánlatkérés PDF / nyomtatás"
        }
        onClick={handleExportPdf}
      >
        <FileDown className="h-4 w-4" />
        PDF
      </Button>
    </div>
  )

  return (
    <div className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
      {/* Fejléc — státusz + egy CTA */}
      <header className="mb-4 border border-slate-300 bg-white px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Alvállalkozói felület
            </p>
            <h1 className="mt-1 text-xl font-semibold leading-snug text-slate-950 sm:text-2xl">
              {invitation.subcontractorName}
            </h1>
            <p className="mt-1 text-sm text-slate-700">{rfq.title}</p>
            {project ? (
              <p className="mt-2 text-sm text-slate-600">
                <span className="font-medium text-slate-800">{project.name}</span>
                {project.siteAddress ? ` — ${project.siteAddress}` : ""}
                {project.code ? (
                  <span className="ml-2 font-mono text-xs text-slate-500">{project.code}</span>
                ) : null}
              </p>
            ) : null}
            <p className="mt-1 text-sm text-slate-600">
              Határidő:{" "}
              <strong className={expired ? "text-red-700" : ""}>
                {new Date(rfq.expiresAt).toLocaleDateString("hu-HU")}
              </strong>
              {existingSubmission ? (
                <>
                  {" · "}
                  Utolsó ajánlat:{" "}
                  <strong className="tabular-nums">
                    {formatHuf(existingSubmission.totalAmount)}
                  </strong>
                </>
              ) : null}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {primaryCta}
            {multiTrade &&
            existingSubmission &&
            multiTrade.nextIncomplete &&
            multiTrade.nextIncomplete.invitationId !== activeInvitationId &&
            canEdit &&
            !showForm ? (
              <Button
                type="button"
                variant="outline"
                className="h-11 gap-1.5 text-sm"
                onClick={() => setEditing(true)}
              >
                <Pencil className="h-4 w-4" />
                Módosítás
              </Button>
            ) : null}
            {exportButtons}
          </div>
        </div>

        <div
          className={cn(
            "mt-4 flex items-start gap-2 border px-3 py-2.5 text-sm font-medium",
            status.tone === "emerald" && "border-emerald-300 bg-emerald-50 text-emerald-950",
            status.tone === "blue" && "border-blue-300 bg-blue-50 text-blue-950",
            status.tone === "amber" && "border-amber-300 bg-amber-50 text-amber-950",
            status.tone === "slate" && "border-slate-300 bg-slate-50 text-slate-800",
            status.tone === "red" && "border-red-300 bg-red-50 text-red-950"
          )}
        >
          {youWon ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          ) : youLost ? (
            <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
          ) : multiTrade && multiTrade.done < multiTrade.total && !expired ? (
            <Clock className="mt-0.5 h-5 w-5 shrink-0" />
          ) : multiTrade && multiTrade.done === multiTrade.total ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <Clock className="mt-0.5 h-5 w-5 shrink-0" />
          )}
          <span>{status.text}</span>
        </div>

        {saveFlash ? (
          <p className="mt-2 text-sm font-medium text-emerald-800">{saveFlash}</p>
        ) : null}
      </header>

      {campaign?.message ? (
        <section className="mb-3 border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
          <p className="font-semibold text-slate-900">Üzenet az építésvezetőtől</p>
          <p className="mt-1 whitespace-pre-wrap">{campaign.message}</p>
        </section>
      ) : null}

      {multiTrade ? (
        <nav className="mb-4 border border-slate-300 bg-white" aria-label="Szakágak">
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Szakágak · {multiTrade.done}/{multiTrade.total} kész
            </p>
            {multiTrade.done < multiTrade.total ? (
              <p className="text-xs font-medium text-amber-800">
                Még {multiTrade.total - multiTrade.done} hiányzik
              </p>
            ) : (
              <p className="text-xs font-medium text-emerald-800">Mind kész</p>
            )}
          </div>
          <ul className="divide-y divide-slate-200">
            {exportPackages.map((pkg, index) => {
              const active = pkg.invitationId === activeInvitationId
              const done = Boolean(pkg.submission)
              const label = packageTradeLabel(pkg)
              return (
                <li key={pkg.invitationId}>
                  <button
                    type="button"
                    onClick={() => selectTrade(pkg.invitationId)}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-3 text-left transition-colors",
                      active
                        ? "bg-slate-900 text-white"
                        : done
                          ? "bg-emerald-50/80 text-slate-900 hover:bg-emerald-50"
                          : "bg-amber-50/50 text-slate-900 hover:bg-amber-50"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center text-sm font-bold",
                        active
                          ? "bg-white text-slate-900"
                          : done
                            ? "bg-emerald-600 text-white"
                            : "border border-amber-400 bg-white text-amber-900"
                      )}
                    >
                      {done && !active ? "✓" : index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{label}</span>
                      <span
                        className={cn(
                          "block text-xs",
                          active ? "text-slate-300" : "text-slate-600"
                        )}
                      >
                        {active
                          ? done
                            ? "Most ezt nézed · beküldve"
                            : "Most ezt töltöd"
                          : done
                            ? `Beküldve · ${formatHuf(pkg.submission!.totalAmount)}`
                            : "Hiányzik — kattints ide"}
                      </span>
                    </span>
                    {active ? (
                      <ChevronRight className="h-5 w-5 shrink-0 text-white" />
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>
      ) : null}

      {/* Ártábla / űrlap */}
      <section className="mb-4" id="ajanlat">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">
          {multiTrade ? (
            <>
              {packageTradeLabel({ rfq })}
              <span className="ml-2 font-normal text-slate-500">
                ({exportPackages.findIndex((p) => p.invitationId === activeInvitationId) + 1}/
                {multiTrade.total})
              </span>
            </>
          ) : showForm ? (
            existingSubmission ? (
              "Módosított ajánlat"
            ) : (
              "Ajánlat kitöltése"
            )
          ) : (
            "Ajánlatod"
          )}
        </h2>

        {showForm ? (
          <form onSubmit={handleSubmit} className="space-y-3">
            <p className="text-sm text-slate-700">
              Írd be az <strong>{COL.materialUnit}</strong> és <strong>{COL.laborUnit}</strong>{" "}
              mezőket (Ft), vagy jelöld a „Nem vállalom” oszlopot.
            </p>

            <PriceTable
              rfq={rfq}
              units={units}
              editable
              formBids={form.lineBids}
              onChangeBid={(lineId, next) =>
                setForm((f) => ({
                  ...f,
                  lineBids: { ...f.lineBids, [lineId]: next },
                }))
              }
            />

            <div className="sticky bottom-0 z-10 border border-slate-300 bg-white p-4 shadow-md">
              {multiTrade && multiTrade.done < multiTrade.total ? (
                <p className="mb-2 text-sm font-medium text-amber-900">
                  {existingSubmission
                    ? `Mentés után még ${multiTrade.total - multiTrade.done} hiányzó szakág`
                    : `${
                        exportPackages.findIndex(
                          (p) => p.invitationId === activeInvitationId
                        ) + 1
                      }. / ${multiTrade.total} szakág · mentés után jön a következő`}
                </p>
              ) : null}
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-sm text-slate-600">
                  Árazott: {pricedCount} / {rfq.lines.length}
                </span>
                <span className="text-lg font-bold tabular-nums">
                  {formatHuf(Math.round(totalAmount))}
                </span>
              </div>
              {submitError ? (
                <p className="mb-3 text-sm text-red-700">{submitError}</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  size="lg"
                  className="h-12 min-w-[14rem] text-base"
                  disabled={submitting || pricedCount === 0}
                >
                  {submitting
                    ? "Küldés…"
                    : multiTrade &&
                        multiTrade.missing.length > (existingSubmission ? 0 : 1)
                      ? existingSubmission
                        ? "Mentés · következő szakág"
                        : "Beküldés · következő szakág"
                      : existingSubmission
                        ? "Módosított ajánlat küldése"
                        : "Ajánlat beküldése"}
                </Button>
                {existingSubmission ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12"
                    onClick={() => {
                      setEditing(false)
                      setForm({
                        subcontractorName: existingSubmission.subcontractorName,
                        contactPhone: existingSubmission.contactPhone,
                        contactEmail: existingSubmission.contactEmail ?? "",
                        notes: existingSubmission.notes,
                        lineBids: bidsFromSubmission(rfq, existingSubmission),
                      })
                    }}
                  >
                    Mégse
                  </Button>
                ) : null}
              </div>
            </div>
          </form>
        ) : existingSubmission ? (
          <PriceTable
            rfq={rfq}
            units={units}
            editable={false}
            submission={existingSubmission}
          />
        ) : expired || lockedByDecision ? (
          <p className="border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-600">
            Nincs beküldött ajánlat.
          </p>
        ) : (
          <div className="border border-amber-200 bg-amber-50 px-4 py-6 text-center">
            <p className="text-sm text-amber-950">Még nem küldtél ajánlatot.</p>
            <Button className="mt-3 h-11" onClick={() => setEditing(true)}>
              Ajánlat kitöltése
            </Button>
          </div>
        )}
      </section>

      {/* Eseménynapló */}
      <section className="mb-4 border border-slate-200 bg-white">
        <h2 className="border-b border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-900">
          Mi történt?
        </h2>
        <ol className="divide-y divide-slate-100">
          {timeline.map((ev) => (
            <li key={ev.id} className="flex gap-3 px-4 py-3 text-sm">
              <span
                className={cn(
                  "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                  ev.tone === "success" && "bg-emerald-500",
                  ev.tone === "warning" && "bg-amber-500",
                  ev.tone === "danger" && "bg-red-500",
                  ev.tone === "neutral" && "bg-slate-400"
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-900">{ev.title}</p>
                {ev.detail ? (
                  <p className="text-slate-600">{ev.detail}</p>
                ) : null}
              </div>
              <time className="shrink-0 text-xs tabular-nums text-slate-500">
                {formatWhen(ev.at)}
              </time>
            </li>
          ))}
        </ol>
      </section>

      {/* Adataim */}
      <section className="mb-4 border border-slate-200 bg-white">
        <h2 className="border-b border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-900">
          Adataim
        </h2>
        {showForm ? (
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Cég / név *</Label>
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
              <Label>Telefon</Label>
              <Input
                className="h-11"
                type="tel"
                value={form.contactPhone}
                onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input
                className="h-11"
                type="email"
                value={form.contactEmail}
                onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Megjegyzés az ajánlathoz</Label>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
        ) : (
          <dl className="grid gap-3 p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Cég / név
              </dt>
              <dd className="mt-0.5 font-medium text-slate-900">
                {existingSubmission?.subcontractorName ?? invitation.subcontractorName}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Telefon
              </dt>
              <dd className="mt-0.5 text-slate-800">
                {existingSubmission?.contactPhone || invitation.contactPhone || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                E-mail
              </dt>
              <dd className="mt-0.5 text-slate-800">
                {existingSubmission?.contactEmail || "—"}
              </dd>
            </div>
            {existingSubmission?.notes ? (
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Megjegyzés
                </dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-slate-800">
                  {existingSubmission.notes}
                </dd>
              </div>
            ) : null}
          </dl>
        )}
      </section>

      {/* Dokumentumok */}
      {campaign && campaign.attachedFolderSnapshots.length > 0 ? (
        <section className="mb-4 border border-slate-200 bg-white">
          <h2 className="border-b border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-900">
            Dokumentumok
          </h2>
          <ul className="divide-y divide-slate-100">
            {campaign.attachedFolderSnapshots.map((folder) => (
              <li
                key={folder.folderId}
                className="flex items-center gap-2 px-4 py-3 text-sm text-slate-700"
              >
                <FolderOpen className="h-4 w-4 shrink-0 text-slate-500" />
                <span>
                  {folder.name}
                  <span className="text-slate-500"> · {folder.fileCount} fájl</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
            A fájlok letöltése hamarosan — egyelőre az építésvezető külön is megküldheti.
          </p>
        </section>
      ) : null}

      {/* Nyomtatási előnézet — képernyőn rejtve */}
      {exportModel ? (
        <div className="pointer-events-none fixed -left-[9999px] top-0 opacity-0" aria-hidden>
          <RfqPublicExportDocument model={exportModel} />
        </div>
      ) : null}
    </div>
  )
}

function PriceTable({
  rfq,
  units,
  editable,
  formBids,
  onChangeBid,
  submission,
}: {
  rfq: SubcontractorRfq
  units: Record<string, string>
  editable: boolean
  formBids?: Record<string, LineBidForm>
  onChangeBid?: (lineId: string, next: LineBidForm) => void
  submission?: SubcontractorRfqSubmission
}) {
  return (
    <div className="overflow-x-auto border border-slate-300 bg-white">
      <table className="w-full min-w-[56rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-300 bg-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600">
            <th className="w-12 border-r border-slate-200 px-2 py-2">{COL.ssz}</th>
            <th className="min-w-[14rem] border-r border-slate-200 px-2 py-2">{COL.text}</th>
            <th className="w-20 border-r border-slate-200 px-2 py-2 text-right">{COL.quantity}</th>
            <th className="w-16 border-r border-slate-200 px-2 py-2">{COL.unit}</th>
            <th className="w-32 border-r border-slate-200 px-2 py-2 text-right">
              {COL.materialUnit}
            </th>
            <th className="w-32 border-r border-slate-200 px-2 py-2 text-right">
              {COL.laborUnit}
            </th>
            <th className="w-28 border-r border-slate-200 px-2 py-2 text-right">
              {COL.materialTotal}
            </th>
            <th className="w-28 border-r border-slate-200 px-2 py-2 text-right">
              {COL.laborTotal}
            </th>
            {editable ? (
              <th className="w-24 px-2 py-2 text-center">Nem vállalom</th>
            ) : (
              <th className="w-28 px-2 py-2 text-right">Sor összesen</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rfq.lines.map((line, index) => {
            if (editable && formBids && onChangeBid) {
              const bid = formBids[line.id] ?? {
                materialUnitPrice: 0,
                laborUnitPrice: 0,
                declined: false,
              }
              const matTotal = bid.declined ? 0 : bid.materialUnitPrice * line.quantity
              const labTotal = bid.declined ? 0 : bid.laborUnitPrice * line.quantity
              return (
                <tr
                  key={line.id}
                  className={cn(
                    "border-b border-slate-200",
                    bid.declined ? "bg-slate-50 text-slate-400" : "bg-white"
                  )}
                >
                  <td className="border-r border-slate-100 px-2 py-1.5 tabular-nums text-slate-500">
                    {index + 1}
                  </td>
                  <td className="border-r border-slate-100 px-2 py-1.5 font-medium text-slate-900">
                    {line.text}
                  </td>
                  <td className="border-r border-slate-100 px-2 py-1.5 text-right tabular-nums">
                    {line.quantity}
                  </td>
                  <td className="border-r border-slate-100 px-2 py-1.5">
                    {units[line.unitId] ?? ""}
                  </td>
                  <td className="border-r border-slate-100 px-1 py-1">
                    <Input
                      type="number"
                      min={0}
                      disabled={bid.declined}
                      className="h-9 border-slate-200 px-2 text-right tabular-nums"
                      value={bid.declined ? "" : bid.materialUnitPrice || ""}
                      onChange={(e) =>
                        onChangeBid(line.id, {
                          ...bid,
                          materialUnitPrice: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </td>
                  <td className="border-r border-slate-100 px-1 py-1">
                    <Input
                      type="number"
                      min={0}
                      disabled={bid.declined}
                      className="h-9 border-slate-200 px-2 text-right tabular-nums"
                      value={bid.declined ? "" : bid.laborUnitPrice || ""}
                      onChange={(e) =>
                        onChangeBid(line.id, {
                          ...bid,
                          laborUnitPrice: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </td>
                  <td className="border-r border-slate-100 px-2 py-1.5 text-right tabular-nums">
                    {matTotal > 0 ? formatHuf(Math.round(matTotal)) : "—"}
                  </td>
                  <td className="border-r border-slate-100 px-2 py-1.5 text-right tabular-nums">
                    {labTotal > 0 ? formatHuf(Math.round(labTotal)) : "—"}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <Checkbox
                      checked={bid.declined}
                      onCheckedChange={(v) =>
                        onChangeBid(line.id, { ...bid, declined: v === true })
                      }
                      aria-label="Nem vállalom"
                    />
                  </td>
                </tr>
              )
            }

            const bid = submission?.lineBids.find((b) => b.rfqLineId === line.id)
            if (!bid || bid.declined) {
              return (
                <tr
                  key={line.id}
                  className="border-b border-slate-200 bg-slate-50 text-slate-400"
                >
                  <td className="border-r border-slate-100 px-2 py-1.5">{index + 1}</td>
                  <td className="border-r border-slate-100 px-2 py-1.5">{line.text}</td>
                  <td className="border-r border-slate-100 px-2 py-1.5 text-right">
                    {line.quantity}
                  </td>
                  <td className="border-r border-slate-100 px-2 py-1.5">
                    {units[line.unitId] ?? ""}
                  </td>
                  <td colSpan={5} className="px-2 py-1.5 italic">
                    nem vállalva
                  </td>
                </tr>
              )
            }
            const matU = bid.materialUnitPrice ?? 0
            const labU = bid.laborUnitPrice ?? bid.unitPrice ?? 0
            return (
              <tr key={line.id} className="border-b border-slate-200">
                <td className="border-r border-slate-100 px-2 py-1.5 tabular-nums text-slate-500">
                  {index + 1}
                </td>
                <td className="border-r border-slate-100 px-2 py-1.5 font-medium text-slate-900">
                  {line.text}
                </td>
                <td className="border-r border-slate-100 px-2 py-1.5 text-right tabular-nums">
                  {line.quantity}
                </td>
                <td className="border-r border-slate-100 px-2 py-1.5">
                  {units[line.unitId] ?? ""}
                </td>
                <td className="border-r border-slate-100 px-2 py-1.5 text-right tabular-nums">
                  {formatHuf(matU)}
                </td>
                <td className="border-r border-slate-100 px-2 py-1.5 text-right tabular-nums">
                  {formatHuf(labU)}
                </td>
                <td className="border-r border-slate-100 px-2 py-1.5 text-right tabular-nums">
                  {formatHuf(Math.round(matU * line.quantity))}
                </td>
                <td className="border-r border-slate-100 px-2 py-1.5 text-right tabular-nums">
                  {formatHuf(Math.round(labU * line.quantity))}
                </td>
                <td className="px-2 py-1.5 text-right font-medium tabular-nums">
                  {formatHuf(getBidLineTotal(bid, line.quantity))}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
