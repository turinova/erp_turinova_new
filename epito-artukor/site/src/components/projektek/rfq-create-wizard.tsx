"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, ChevronLeft, ChevronRight, FolderOpen } from "lucide-react"
import { toast } from "sonner"
import type { Quote } from "@/types/projects"
import type { Trade } from "@/types"
import type { Subcontractor } from "@/types/subcontractors"
import {
  createRfqCampaign,
  listQuoteLines,
  listRfqsForProject,
} from "@/lib/data/projects-store"
import {
  countFilesInFolder,
  listProjectFileFolders,
} from "@/lib/data/project-files-store"
import { listSubcontractors, resolveSubcontractorInviteFields } from "@/lib/data/subcontractors-store"
import { getRfqTitleForTrade, pickDefaultRfqTrade } from "@/lib/quote-summary"
import { quoteTradeLabel } from "@/lib/quote-list-helpers"
import { linesWithManualPriceWarning } from "@/lib/trade-rfq-summary"
import { getTradeLabel } from "@/lib/trades"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import { RfqLinksPanel } from "@/components/projektek/rfq-links-panel"
import {
  buildInitialLineSelection,
  defaultRfqLineIds,
  RfqWizardTradeLines,
  RfqWizardTradeScopeRow,
} from "@/components/projektek/rfq-wizard-trade-lines"
import { cn } from "@/lib/utils"

export type RfqCreatedLink = {
  invitationId: string
  subcontractorName: string
  tradeLabel: string
  packageTitle: string
  accessToken: string
  accessCode: string
}

type RfqCreateWizardProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  quotes: Quote[]
  initialQuoteId?: string | null
  onCreated: (quoteIds: string[]) => void
}

type WizardStep = 1 | 2 | 3 | 4

const STEPS: { id: WizardStep; label: string }[] = [
  { id: 1, label: "Mit?" },
  { id: 2, label: "Dokumentumok" },
  { id: 3, label: "Kik?" },
  { id: 4, label: "Küldés" },
]

function detectLineOverlap(
  quoteId: string,
  lineIds: string[],
  packages: ReturnType<typeof listRfqsForProject>
): boolean {
  const active = packages.filter((p) => p.quoteId === quoteId && p.status === "open")
  for (const pkg of active) {
    for (const rfl of pkg.lines) {
      if (rfl.quoteLineId && lineIds.includes(rfl.quoteLineId)) return true
    }
  }
  return false
}

function quoteTrade(quote: Quote, lines: ReturnType<typeof listQuoteLines>): Trade {
  return quote.primaryTrade ?? pickDefaultRfqTrade(lines)
}

export function RfqCreateWizard({
  open,
  onOpenChange,
  projectId,
  quotes,
  initialQuoteId,
  onCreated,
}: RfqCreateWizardProps) {
  const activeQuotes = useMemo(
    () => quotes.filter((q) => q.status !== "archived"),
    [quotes]
  )

  const [step, setStep] = useState<WizardStep>(1)
  const [selectedQuoteIds, setSelectedQuoteIds] = useState<string[]>([])
  const [selectedLineIds, setSelectedLineIds] = useState<Record<string, string[]>>({})
  const [expandedQuoteIds, setExpandedQuoteIds] = useState<string[]>([])
  const [folderIds, setFolderIds] = useState<string[]>([])
  const [matrix, setMatrix] = useState<Record<string, Record<string, boolean>>>({})
  const [partnerSearch, setPartnerSearch] = useState("")
  const [message, setMessage] = useState("")
  const [expiresInDays, setExpiresInDays] = useState(14)
  const [createdLinks, setCreatedLinks] = useState<RfqCreatedLink[] | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const allPackages = useMemo(() => listRfqsForProject(projectId), [projectId, open])

  const folders = useMemo(() => {
    if (!open) return []
    return listProjectFileFolders(projectId).filter((f) => !f.isSystem)
  }, [projectId, open])

  const quoteScopes = useMemo(() => {
    return activeQuotes.map((quote) => {
      const lines = listQuoteLines(quote.id)
      return {
        quote,
        trade: quoteTrade(quote, lines),
        tradeLabel: quoteTradeLabel(quote),
        lineCount: lines.length,
        lineIds: lines.map((l) => l.id),
        lines,
      }
    })
  }, [activeQuotes])

  const selectedScopes = useMemo(
    () =>
      quoteScopes
        .filter((s) => selectedQuoteIds.includes(s.quote.id))
        .map((s) => {
          const lineIds =
            selectedLineIds[s.quote.id] ?? defaultRfqLineIds(s.lines)
          return {
            ...s,
            lineIds,
            selectedLineCount: lineIds.length,
          }
        }),
    [quoteScopes, selectedQuoteIds, selectedLineIds]
  )

  const selectedTrades = useMemo(
    () => new Set(selectedScopes.map((s) => s.trade)),
    [selectedScopes]
  )

  const matrixSubs = useMemo(() => {
    const q = partnerSearch.trim().toLowerCase()
    return listSubcontractors()
      .filter((s) => s.status !== "inactive" && s.status !== "blocked")
      .filter((s) => s.trades.some((t) => selectedTrades.has(t)))
      .filter((s) => {
        if (!q) return true
        return (
          s.displayName.toLowerCase().includes(q) ||
          s.legalName.toLowerCase().includes(q)
        )
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "hu"))
  }, [selectedTrades, partnerSearch])

  const invitationCount = useMemo(() => {
    let n = 0
    for (const sub of matrixSubs) {
      for (const scope of selectedScopes) {
        if (matrix[sub.id]?.[scope.quote.id] && sub.trades.includes(scope.trade)) n++
      }
    }
    return n
  }, [matrix, matrixSubs, selectedScopes])

  const overlapWarnings = useMemo(() => {
    return selectedScopes.filter((s) =>
      detectLineOverlap(s.quote.id, s.lineIds, allPackages)
    )
  }, [selectedScopes, allPackages])

  const manualWarnCount = useMemo(() => {
    let n = 0
    for (const scope of selectedScopes) {
      const selected = scope.lines.filter((l) => scope.lineIds.includes(l.id))
      n += linesWithManualPriceWarning(selected).length
    }
    return n
  }, [selectedScopes])

  const resetWizard = (quoteId?: string | null) => {
    const lineSelection = buildInitialLineSelection(
      quoteScopes.map((s) => ({ id: s.quote.id, lines: s.lines }))
    )
    const initial =
      quoteId && activeQuotes.some((q) => q.id === quoteId)
        ? [quoteId]
        : activeQuotes.length === 1
          ? [activeQuotes[0].id]
          : []
    setStep(1)
    setSelectedQuoteIds(initial)
    setSelectedLineIds(lineSelection)
    setExpandedQuoteIds(initial.length === 1 ? [...initial] : [])
    setFolderIds([])
    setMatrix({})
    setPartnerSearch("")
    setMessage("")
    setExpiresInDays(14)
    setCreatedLinks(null)
    setSubmitting(false)
  }

  useEffect(() => {
    if (!open) return
    resetWizard(initialQuoteId)
  }, [open, initialQuoteId, activeQuotes.length])

  const toggleQuote = (quoteId: string) => {
    setSelectedQuoteIds((prev) => {
      const adding = !prev.includes(quoteId)
      if (adding) {
        const scope = quoteScopes.find((s) => s.quote.id === quoteId)
        if (scope && !selectedLineIds[quoteId]?.length) {
          setSelectedLineIds((lines) => ({
            ...lines,
            [quoteId]: defaultRfqLineIds(scope.lines),
          }))
        }
        setExpandedQuoteIds((exp) => (exp.includes(quoteId) ? exp : [...exp, quoteId]))
        return [...prev, quoteId]
      }
      return prev.filter((id) => id !== quoteId)
    })
  }

  const toggleExpandQuote = (quoteId: string) => {
    setExpandedQuoteIds((prev) =>
      prev.includes(quoteId) ? prev.filter((id) => id !== quoteId) : [...prev, quoteId]
    )
  }

  const setQuoteLineIds = (quoteId: string, lineIds: string[]) => {
    setSelectedLineIds((prev) => ({ ...prev, [quoteId]: lineIds }))
  }

  const toggleFolder = (folderId: string) => {
    setFolderIds((prev) =>
      prev.includes(folderId) ? prev.filter((id) => id !== folderId) : [...prev, folderId]
    )
  }

  const toggleMatrix = (subId: string, quoteId: string) => {
    setMatrix((prev) => ({
      ...prev,
      [subId]: {
        ...(prev[subId] ?? {}),
        [quoteId]: !(prev[subId]?.[quoteId] ?? false),
      },
    }))
  }

  const selectAllTradesForSub = (sub: Subcontractor) => {
    setMatrix((prev) => {
      const row = { ...(prev[sub.id] ?? {}) }
      for (const scope of selectedScopes) {
        if (sub.trades.includes(scope.trade)) row[scope.quote.id] = true
      }
      return { ...prev, [sub.id]: row }
    })
  }

  const canNext = (): boolean => {
    if (step === 1) {
      return (
        selectedScopes.length > 0 &&
        selectedScopes.every((s) => s.lineCount > 0 && s.selectedLineCount > 0)
      )
    }
    if (step === 3) return invitationCount > 0
    return true
  }

  const goNext = () => {
    if (!canNext()) {
      if (step === 1) {
        toast.error("Válassz legalább egy szakágot és tételt a bekéréshez")
      }
      if (step === 3) toast.error("Jelölj ki legalább egy partnert valamelyik szakághoz")
      return
    }
    setStep((s) => Math.min(4, s + 1) as WizardStep)
  }

  const goBack = () => setStep((s) => Math.max(1, s - 1) as WizardStep)

  const handleSubmit = async () => {
    if (invitationCount === 0) {
      toast.error("Nincs kiválasztott partner")
      return
    }
    setSubmitting(true)
    try {
      const folderSnapshots = folderIds.map((folderId) => {
        const folder = folders.find((f) => f.id === folderId)
        return {
          folderId,
          name: folder?.name ?? "Mappa",
          fileCount: countFilesInFolder(projectId, folderId),
        }
      })

      const packages = selectedScopes
        .filter((scope) => scope.lineIds.length > 0)
        .map((scope) => {
        const subcontractors = matrixSubs
          .filter(
            (sub) =>
              sub.trades.includes(scope.trade) && matrix[sub.id]?.[scope.quote.id]
          )
          .map((sub) => resolveSubcontractorInviteFields(sub))

        return {
          quoteId: scope.quote.id,
          trade: scope.trade,
          title: getRfqTitleForTrade(scope.trade),
          lineIds: scope.lineIds,
          subcontractors,
        }
      })

      const { packages: created } = createRfqCampaign({
        projectId,
        message,
        expiresInDays,
        attachedFolderIds: folderIds,
        attachedFolderSnapshots: folderSnapshots,
        packages,
      })

      const links: RfqCreatedLink[] = []
      for (const { pkg, invitations } of created) {
        const scope = quoteScopes.find((s) => s.quote.id === pkg.quoteId)
        const tradeLabel = scope?.tradeLabel ?? getTradeLabel(pkg.trade)
        for (const inv of invitations) {
          links.push({
            invitationId: inv.id,
            subcontractorName: inv.subcontractorName,
            tradeLabel,
            packageTitle: pkg.title,
            accessToken: inv.accessToken,
            accessCode: inv.accessCode,
          })
        }
      }

      setCreatedLinks(links)
      onCreated([...new Set(created.map((c) => c.pkg.quoteId))])
      toast.success(`${links.length} bekérés indítva`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nem sikerült létrehozni a bekéréseket")
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(96vh,880px)] max-h-[96vh] w-[min(96vw,1100px)] max-w-[96vw] flex-col gap-0 overflow-hidden p-0">
        {createdLinks ? (
          <RfqLinksPanel links={createdLinks} onClose={handleClose} />
        ) : (
          <>
            <div className="shrink-0 border-b px-4 py-3">
              <h2 className="text-lg font-semibold text-slate-900">Új alvállalkozói bekérés</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {STEPS.map((s) => (
                  <div
                    key={s.id}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium",
                      step === s.id
                        ? "bg-blue-600 text-white"
                        : step > s.id
                          ? "bg-blue-100 text-blue-900"
                          : "bg-slate-100 text-slate-600"
                    )}
                  >
                    {s.id}. {s.label}
                  </div>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {step === 1 ? (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600">
                    Válaszd ki a szakágokat, majd szükség esetén szerkeszd a tételeket. Alapból az
                    árazatlan (és bekérésre váró) sorok vannak kijelölve.
                  </p>
                  <div className="space-y-2">
                    {quoteScopes.map((scope) => {
                      const checked = selectedQuoteIds.includes(scope.quote.id)
                      const disabled = scope.lineCount === 0
                      const lineIds =
                        selectedLineIds[scope.quote.id] ?? defaultRfqLineIds(scope.lines)
                      return (
                        <RfqWizardTradeScopeRow
                          key={scope.quote.id}
                          tradeLabel={scope.tradeLabel}
                          lineCount={scope.lineCount}
                          selectedLineCount={lineIds.length}
                          checked={checked}
                          disabled={disabled}
                          expanded={expandedQuoteIds.includes(scope.quote.id)}
                          onToggleTrade={() => !disabled && toggleQuote(scope.quote.id)}
                          onToggleExpand={() => toggleExpandQuote(scope.quote.id)}
                        >
                          <RfqWizardTradeLines
                            quoteId={scope.quote.id}
                            lines={scope.lines}
                            selectedLineIds={lineIds}
                            onChange={(ids) => setQuoteLineIds(scope.quote.id, ids)}
                          />
                        </RfqWizardTradeScopeRow>
                      )
                    })}
                  </div>
                  {overlapWarnings.length > 0 ? (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <p>
                        {overlapWarnings.map((s) => s.tradeLabel).join(", ")} — már van nyitott
                        bekérés ezekre a tételekre.
                      </p>
                    </div>
                  ) : null}
                  {manualWarnCount > 0 ? (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <p>{manualWarnCount} kijelölt tételnél már van kézi bekerülés.</p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600">
                    Válaszd ki a projekt mappáit, amiket a partnerek látni fognak a bekérésben
                    (tervek, felmérés képek stb.).
                  </p>
                  {folders.length === 0 ? (
                    <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-slate-500">
                      Még nincs mappa a Dokumentumok fülön — opcionálisan kihagyhatod ezt a lépést.
                    </p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {folders.map((folder) => {
                        const checked = folderIds.includes(folder.id)
                        const fileCount = countFilesInFolder(projectId, folder.id)
                        return (
                          <label
                            key={folder.id}
                            className={cn(
                              "flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3",
                              checked && "border-blue-300 bg-blue-50/50"
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleFolder(folder.id)}
                            />
                            <FolderOpen className="h-5 w-5 shrink-0 text-slate-500" />
                            <div>
                              <p className="font-medium text-slate-900">{folder.name}</p>
                              <p className="text-xs text-slate-500">{fileCount} fájl</p>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="rfq-message">Üzenet a partnereknek (opcionális)</Label>
                    <Textarea
                      id="rfq-message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Pl. kérlek a mellékelt tervek alapján adj árajánlatot…"
                      rows={3}
                      className="text-sm"
                    />
                  </div>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600">
                    Jelöld be, melyik partner melyik szakágra kapjon meghívót. Egy cég több szakágra
                    is kaphat bekérést.
                  </p>
                  <Input
                    value={partnerSearch}
                    onChange={(e) => setPartnerSearch(e.target.value)}
                    placeholder="Partner keresése…"
                    className="max-w-sm text-sm"
                  />
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full min-w-[32rem] border-collapse text-sm">
                      <thead className="ea-table-head text-xs">
                        <tr>
                          <th className="min-w-[10rem] px-3 py-2 text-left">Partner</th>
                          {selectedScopes.map((scope) => (
                            <th key={scope.quote.id} className="px-3 py-2 text-center">
                              {scope.tradeLabel}
                            </th>
                          ))}
                          <th className="px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {matrixSubs.length === 0 ? (
                          <tr>
                            <td
                              colSpan={selectedScopes.length + 2}
                              className="px-4 py-8 text-center text-slate-500"
                            >
                              Nincs partner a kiválasztott szakágokhoz a törzsben.
                            </td>
                          </tr>
                        ) : (
                          matrixSubs.map((sub) => (
                            <tr key={sub.id} className="border-t hover:bg-slate-50/80">
                              <td className="px-3 py-2 font-medium text-slate-900">
                                {sub.displayName}
                              </td>
                              {selectedScopes.map((scope) => {
                                const can = sub.trades.includes(scope.trade)
                                const checked = matrix[sub.id]?.[scope.quote.id] ?? false
                                return (
                                  <td key={scope.quote.id} className="px-3 py-2 text-center">
                                    {can ? (
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggleMatrix(sub.id, scope.quote.id)}
                                        aria-label={`${sub.displayName} — ${scope.tradeLabel}`}
                                      />
                                    ) : (
                                      <span className="text-slate-300">—</span>
                                    )}
                                  </td>
                                )
                              })}
                              <td className="px-3 py-2 text-right">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs"
                                  onClick={() => selectAllTradesForSub(sub)}
                                >
                                  Mind
                                </Button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-slate-500">
                    {invitationCount} meghívó készül ({selectedScopes.length} szakág).
                  </p>
                </div>
              ) : null}

              {step === 4 ? (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600">Ellenőrizd az összefoglalót, majd indítsd a bekéréseket.</p>
                  <div className="overflow-hidden rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-xs">
                        <tr>
                          <th className="px-3 py-2 text-left">Szakág</th>
                          <th className="px-3 py-2 text-right">Tételek</th>
                          <th className="px-3 py-2 text-right">Partnerek</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedScopes.map((scope) => {
                          const partnerCount = matrixSubs.filter(
                            (sub) =>
                              sub.trades.includes(scope.trade) &&
                              matrix[sub.id]?.[scope.quote.id]
                          ).length
                          return (
                            <tr key={scope.quote.id} className="border-t">
                              <td className="px-3 py-2.5 font-medium">{scope.tradeLabel}</td>
                              <td className="px-3 py-2.5 text-right tabular-nums">
                                {scope.selectedLineCount}
                                <span className="text-slate-500"> / {scope.lineCount}</span>
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums">
                                {partnerCount}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  {folderIds.length > 0 ? (
                    <p className="text-sm text-slate-700">
                      <strong>Melléklet:</strong>{" "}
                      {folderIds
                        .map((id) => folders.find((f) => f.id === id)?.name)
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  ) : null}
                  {message.trim() ? (
                    <p className="rounded-lg border bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      <strong>Üzenet:</strong> {message.trim()}
                    </p>
                  ) : null}
                  <div className="max-w-xs space-y-2">
                    <Label htmlFor="rfq-expires">Határidő (nap)</Label>
                    <Input
                      id="rfq-expires"
                      type="number"
                      min={1}
                      max={90}
                      value={expiresInDays}
                      onChange={(e) =>
                        setExpiresInDays(Math.max(1, parseInt(e.target.value, 10) || 14))
                      }
                      className="text-sm"
                    />
                  </div>
                  <p className="text-sm font-medium text-slate-900">
                    Összesen: <strong>{invitationCount}</strong> link generálódik.
                  </p>
                </div>
              ) : null}
            </div>

            <div className="flex shrink-0 justify-between border-t px-4 py-3">
              <Button type="button" variant="outline" onClick={step === 1 ? handleClose : goBack}>
                {step === 1 ? (
                  "Mégse"
                ) : (
                  <>
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Vissza
                  </>
                )}
              </Button>
              {step < 4 ? (
                <Button type="button" onClick={goNext}>
                  Tovább
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button type="button" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? "Indítás…" : `Bekérések indítása (${invitationCount})`}
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
