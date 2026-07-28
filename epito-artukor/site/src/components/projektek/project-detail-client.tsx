"use client"

import { useMemo, useState, useEffect, type CSSProperties } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronDown } from "lucide-react"
import { toast } from "sonner"
import type { Trade } from "@/types"
import {
  createQuote,
  deleteQuote,
  duplicateQuote,
  archiveQuote,
  getProject,
  listQuotesForProject,
  listQuoteLines,
  listRfqsForQuote,
  listSubmissionsForQuote,
  listInvitationsForQuote,
  updateProject,
} from "@/lib/data/projects-store"
import {
  buildQuoteSummary,
} from "@/lib/quote-summary"
import { ProjectDetailHeader } from "@/components/projektek/project-detail-header"
import {
  ProjectStatusStrip,
} from "@/components/projektek/project-status-strip"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useProjectBundleLoaded } from "@/hooks/use-project-bundle-loaded"
import { ProjectQuotesTab } from "@/components/projektek/project-quotes-tab"
import { ProjectOfferTab } from "@/components/projektek/project-offer-tab"
import { RfqProjectTab } from "@/components/projektek/rfq-project-tab"
import { ProjectFilesTab } from "@/components/projektek/project-files-tab"
import { ProjectExportTab } from "@/components/projektek/project-export-tab"
import { ProjectCloseDialog } from "@/components/projektek/project-close-dialog"
import { QuoteImportWizard } from "@/components/projektek/quote-import-wizard"
import {
  ProjectEditDialog,
  type ProjectEditForm,
} from "@/components/projektek/project-edit-dialog"
import { listProjectFiles } from "@/lib/data/project-files-store"
import { buildProjectOverviewSummary } from "@/lib/project-overview-summary"
import { buildProjectHeroAction } from "@/lib/project-overview-dashboard"
import { buildProjectStatusFacts } from "@/lib/project-status-facts"
import { useTradeOptions } from "@/components/trades/trades-provider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { QUOTE_STATUS_LABELS } from "@/lib/project-labels"
import { findNavItemByHref } from "@/lib/nav-config"
import { listHrefForProject } from "@/lib/project-phase"

type Tab = "quotes" | "offer" | "rfq" | "files" | "export"

const PRIMARY_TABS: { id: Tab; label: string }[] = [
  { id: "quotes", label: "Költségvetés" },
  { id: "offer", label: "Ügyfélnek" },
  { id: "rfq", label: "Bekérés" },
]

const MORE_TABS: { id: Tab; label: string }[] = [
  { id: "files", label: "Dokumentumok" },
  { id: "export", label: "Export" },
]

type ProjectDetailClientProps = {
  projectId: string
}

export function ProjectDetailClient({ projectId }: ProjectDetailClientProps) {
  const tradeOptions = useTradeOptions()
  const projectLoaded = useProjectBundleLoaded(projectId)
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<Tab>("quotes")
  const [tick, setTick] = useState(0)
  const [newQuoteOpen, setNewQuoteOpen] = useState(false)
  const [quoteTitle, setQuoteTitle] = useState("Új árajánlat")
  const [quoteTrade, setQuoteTrade] = useState<Trade>("gepeszet")
  const [isVersion, setIsVersion] = useState(false)
  const [supersedesQuoteId, setSupersedesQuoteId] = useState<string>("")
  const [newQuoteAsPotmunka, setNewQuoteAsPotmunka] = useState(false)
  const [rfqQuoteFilter, setRfqQuoteFilter] = useState<string | null>(null)
  const [rfqAutoOpen, setRfqAutoOpen] = useState(false)
  const [editProjectOpen, setEditProjectOpen] = useState(false)
  const [closeProjectOpen, setCloseProjectOpen] = useState(false)
  const [quoteImportOpen, setQuoteImportOpen] = useState(false)

  const refresh = () => setTick((t) => t + 1)

  useEffect(() => {
    const t = searchParams.get("tab")
    const q = searchParams.get("quote")
    if (t === "overview") {
      // Legacy: Munka tab megszűnt → Költségvetés (default URL)
      setTab("quotes")
      const params = new URLSearchParams(searchParams.toString())
      params.delete("tab")
      const qs = params.toString()
      router.replace(`/projektek/${projectId}${qs ? `?${qs}` : ""}`, { scroll: false })
      setRfqQuoteFilter(q)
      return
    }
    if (
      t === "quotes" ||
      t === "offer" ||
      t === "rfq" ||
      t === "files" ||
      t === "export"
    ) {
      setTab(t)
    }
    setRfqQuoteFilter(q)
  }, [searchParams, projectId, router])

  const syncUrl = (newTab: Tab, quoteId?: string | null) => {
    const params = new URLSearchParams()
    if (newTab !== "quotes") params.set("tab", newTab)
    const q = quoteId !== undefined ? quoteId : rfqQuoteFilter
    if (q) params.set("quote", q)
    const qs = params.toString()
    router.replace(`/projektek/${projectId}${qs ? `?${qs}` : ""}`, { scroll: false })
  }

  useEffect(() => {
    if (projectLoaded) refresh()
  }, [projectLoaded])

  const project = useMemo(
    () => (projectLoaded ? getProject(projectId) : undefined),
    [projectId, tick, projectLoaded]
  )
  const quotes = useMemo(
    () => (projectLoaded ? listQuotesForProject(projectId) : []),
    [projectId, tick, projectLoaded]
  )

  useEffect(() => {
    if (!projectLoaded) return
    if (searchParams.get("newQuote") !== "1") return

    const potmunka = searchParams.get("potmunka") === "1"
    setNewQuoteAsPotmunka(potmunka)
    setQuoteTitle(potmunka ? "Pótmunka" : "Új árajánlat")
    setIsVersion(false)
    setSupersedesQuoteId("")
    setTab("quotes")
    setNewQuoteOpen(true)

    const params = new URLSearchParams(searchParams.toString())
    params.delete("newQuote")
    params.delete("potmunka")
    if (params.get("tab") === "quotes") params.delete("tab")
    const qs = params.toString()
    router.replace(`/projektek/${projectId}${qs ? `?${qs}` : ""}`, { scroll: false })
  }, [projectLoaded, searchParams, projectId, router])

  useEffect(() => {
    if (!projectLoaded || quotes.length === 0) return
    if (searchParams.get("openRfq") !== "1") return

    const quoteParam = searchParams.get("quote")
    const targetQuote = quoteParam
      ? quotes.find((q) => q.id === quoteParam)
      : quotes[0]
    if (!targetQuote) return

    const allLines = listQuoteLines(targetQuote.id)
    if (allLines.length === 0) return

    setTab("rfq")
    setRfqQuoteFilter(targetQuote.id)
    setRfqAutoOpen(true)

    const params = new URLSearchParams(searchParams.toString())
    params.delete("openRfq")
    params.set("tab", "rfq")
    params.set("quote", targetQuote.id)
    router.replace(`/projektek/${projectId}?${params.toString()}`, { scroll: false })
  }, [projectLoaded, quotes, searchParams, projectId, router])

  const quoteSummaries = useMemo(() => {
    if (!projectLoaded) return new Map()
    return new Map(
      quotes.map((q) => {
        const lines = listQuoteLines(q.id)
        const quoteRfqs = listRfqsForQuote(q.id)
        const subs = listSubmissionsForQuote(q.id)
        const invitations = listInvitationsForQuote(q.id)
        return [q.id, buildQuoteSummary(q, lines, quoteRfqs, subs, invitations)] as const
      })
    )
  }, [quotes, tick, projectLoaded])

  const fileCount = useMemo(() => {
    void tick
    return projectLoaded ? listProjectFiles(projectId).length : 0
  }, [projectId, tick, projectLoaded])

  const overviewSummary = useMemo(() => {
    void tick
    if (!projectLoaded) return null
    return buildProjectOverviewSummary(projectId)
  }, [projectId, tick, projectLoaded])

  const statusStrip = useMemo(() => {
    void tick
    if (!projectLoaded) return null
    const facts = buildProjectStatusFacts(projectId)
    const hero = buildProjectHeroAction(projectId)
    const alert =
      hero.tone === "error"
        ? {
            message: hero.title,
            actionLabel: hero.actionLabel,
            action: hero.action,
            quoteId: hero.quoteId ?? null,
          }
        : null

    return {
      facts: facts.facts,
      grossLabel: facts.grossLabel,
      alert,
    }
  }, [projectId, tick, projectLoaded])

  const statusLine = useMemo(() => {
    if (!overviewSummary) return null
    const first = overviewSummary.attention[0]
    if (first) return first.message
    return overviewSummary.healthLabel
  }, [overviewSummary])

  const openRfqDialog = (quoteId?: string) => {
    const targetQuote = quoteId ? quotes.find((q) => q.id === quoteId) : quotes[0]
    if (!targetQuote) {
      toast.error("Előbb hozz létre egy árajánlatot")
      return
    }
    const allLines = listQuoteLines(targetQuote.id)
    if (allLines.length === 0) {
      toast.error("Előbb adj hozzá tételeket az árajánlathoz")
      return
    }
    setTab("rfq")
    setRfqQuoteFilter(targetQuote.id)
    syncUrl("rfq", targetQuote.id)
    setRfqAutoOpen(true)
  }

  const goToTab = (newTab: Tab, quoteId?: string | null) => {
    setTab(newTab)
    syncUrl(newTab, newTab === "rfq" ? quoteId ?? rfqQuoteFilter : null)
  }

  const handleCriticalAlert = () => {
    const alert = statusStrip?.alert
    if (!alert) return
    if (alert.action === "navigate_rfq") {
      if (alert.quoteId) setRfqQuoteFilter(alert.quoteId)
      goToTab("rfq", alert.quoteId)
      return
    }
    if (alert.action === "create_quote") {
      setNewQuoteOpen(true)
      return
    }
    goToTab("quotes")
  }

  if (!projectLoaded) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-slate-500">Projekt betöltése…</p>
      </div>
    )
  }

  if (!project) {
    return <p className="text-slate-500">A projekt nem található.</p>
  }

  const handleCreateQuote = () => {
    const title = quoteTitle.trim() || (newQuoteAsPotmunka ? "Pótmunka" : "Új árajánlat")
    const q = createQuote(projectId, title, {
      primaryTrade: quoteTrade,
      supersedesQuoteId: isVersion && supersedesQuoteId ? supersedesQuoteId : undefined,
    })
    setNewQuoteOpen(false)
    setIsVersion(false)
    setSupersedesQuoteId("")
    setNewQuoteAsPotmunka(false)
    refresh()
    router.push(`/projektek/${projectId}/ajanlat/${q.id}`)
  }

  const handleDuplicateQuote = (quoteId: string) => {
    const copy = duplicateQuote(quoteId)
    if (!copy) {
      toast.error("Nem sikerült duplikálni")
      return
    }
    refresh()
    toast.success(`Másolat létrehozva: ${copy.title}`)
  }

  const handleDeleteQuote = (quoteId: string) => {
    const quote = quotes.find((q) => q.id === quoteId)
    if (!quote) return
    if (!confirm(`„${quote.title}” törlése?`)) return
    if (!deleteQuote(quoteId)) {
      toast.error("Nem törölhető — van hozzá kapcsolódó alvállalkozói bekérés")
      return
    }
    refresh()
    toast.success("Árajánlat törölve")
  }

  const handleArchiveQuote = (quoteId: string) => {
    const quote = quotes.find((q) => q.id === quoteId)
    if (!quote) return
    if (!confirm(`„${quote.title}” archiválása?`)) return
    archiveQuote(quoteId)
    refresh()
    toast.success("Árajánlat archiválva")
  }

  const handleSaveProject = (form: ProjectEditForm) => {
    updateProject(projectId, form)
    setEditProjectOpen(false)
    refresh()
    toast.success("Projekt adatai mentve")
  }

  const moreTabs = MORE_TABS.map((t) =>
    t.id === "files" && fileCount > 0
      ? { ...t, label: `Dokumentumok (${fileCount})` }
      : t
  )
  const moreActive = moreTabs.some((t) => t.id === tab)

  const phaseNavItem = findNavItemByHref(listHrefForProject(project))
  const accentStyle = {
    "--page-accent": phaseNavItem?.accent ?? "var(--brand)",
    "--page-accent-muted": phaseNavItem?.accentMuted ?? "var(--brand-muted)",
  } as CSSProperties

  return (
    <div style={accentStyle} className="contents">
      <ProjectDetailHeader
        project={project}
        statusLine={statusLine}
        onEdit={() => setEditProjectOpen(true)}
        onClose={
          project.status === "won" || project.status === "in_progress"
            ? () => setCloseProjectOpen(true)
            : undefined
        }
      />

      {statusStrip ? (
        <ProjectStatusStrip
          facts={statusStrip.facts}
          grossLabel={statusStrip.grossLabel}
          alert={
            statusStrip.alert
              ? {
                  message: statusStrip.alert.message,
                  actionLabel: statusStrip.alert.actionLabel,
                  onAction: handleCriticalAlert,
                }
              : null
          }
        />
      ) : null}

      <div className="mb-6 flex flex-wrap items-end gap-1 border-b">
        {PRIMARY_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => goToTab(t.id, t.id === "rfq" ? rfqQuoteFilter : null)}
            className={cn(
              "border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              tab === t.id
                ? "border-[var(--page-accent)] text-[var(--page-accent)]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            {t.label}
          </button>
        ))}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                moreActive
                  ? "border-[var(--page-accent)] text-[var(--page-accent)]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              )}
            >
              Több
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[11rem] p-1">
            {moreTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                className={cn(
                  "flex w-full items-center rounded-sm px-3 py-2.5 text-left text-sm font-medium hover:bg-slate-100",
                  tab === t.id && "bg-slate-50 text-[var(--page-accent)]"
                )}
                onClick={() => goToTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {tab === "quotes" ? (
        <ProjectQuotesTab
          project={project}
          projectId={projectId}
          quotes={quotes}
          quoteSummaries={quoteSummaries}
          tick={tick}
          onNewQuote={(opts) => {
            setNewQuoteAsPotmunka(opts?.potmunka === true)
            setQuoteTitle(opts?.potmunka ? "Pótmunka" : "Új árajánlat")
            setIsVersion(false)
            setSupersedesQuoteId("")
            setNewQuoteOpen(true)
          }}
          onImportQuote={() => setQuoteImportOpen(true)}
          onDuplicate={handleDuplicateQuote}
          onDelete={handleDeleteQuote}
          onArchive={handleArchiveQuote}
          onStartRfq={openRfqDialog}
          onOpenOfferTab={() => goToTab("offer")}
          onRefresh={refresh}
        />
      ) : null}

      {tab === "offer" ? (
        <ProjectOfferTab projectId={projectId} tick={tick} onRefresh={refresh} />
      ) : null}

      {tab === "export" ? (
        <ProjectExportTab
          project={project}
          quotes={quotes}
          quoteSummaries={quoteSummaries}
        />
      ) : null}

      {tab === "files" ? (
        <ProjectFilesTab
          project={project}
          projectId={projectId}
          tick={tick}
          onRefresh={refresh}
        />
      ) : null}

      {tab === "rfq" ? (
        <RfqProjectTab
          project={project}
          projectId={projectId}
          quotes={quotes}
          rfqQuoteFilter={rfqQuoteFilter}
          onClearQuoteFilter={() => {
            setRfqQuoteFilter(null)
            syncUrl("rfq", null)
          }}
          tick={tick}
          onRefresh={refresh}
          autoOpenCreate={rfqAutoOpen}
          onAutoOpenHandled={() => setRfqAutoOpen(false)}
          initialQuoteId={rfqQuoteFilter}
        />
      ) : null}

      <Dialog
        open={newQuoteOpen}
        onOpenChange={(open) => {
          setNewQuoteOpen(open)
          if (!open) setNewQuoteAsPotmunka(false)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {newQuoteAsPotmunka ? "Pótmunka szakág" : "Új szakági ajánlat"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {newQuoteAsPotmunka ? (
              <p className="text-sm text-slate-600">
                Új munka a szerződéshez. Árazás után az Ügyfélnek fülön kiegészítő ajánlatként
                küldheted.
              </p>
            ) : null}
            <div className="space-y-2">
              <Label>Szakág</Label>
              <Select value={quoteTrade} onValueChange={(v) => setQuoteTrade(v as Trade)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tradeOptions.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Megnevezés</Label>
              <Input value={quoteTitle} onChange={(e) => setQuoteTitle(e.target.value)} />
            </div>
            {!newQuoteAsPotmunka ? (
              <>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={isVersion}
                    onChange={(e) => setIsVersion(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Verzió — egy meglévő ajánlat új változata
                </label>
                {isVersion ? (
                  <div className="space-y-2">
                    <Label>Melyik ajánlatot váltja fel?</Label>
                    <Select value={supersedesQuoteId} onValueChange={setSupersedesQuoteId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Válassz ajánlatot…" />
                      </SelectTrigger>
                      <SelectContent>
                        {quotes
                          .filter((q) => q.status !== "archived" && q.primaryTrade === quoteTrade)
                          .map((q) => (
                            <SelectItem key={q.id} value={q.id}>
                              {q.title} ({QUOTE_STATUS_LABELS[q.status]})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Több ajánlat is lehet ugyanarra a szakágra — később az Árajánlat fülön választod
                    ki, melyik megy az ügyfélnek.
                  </p>
                )}
              </>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewQuoteOpen(false)}>
              Mégse
            </Button>
            <Button onClick={handleCreateQuote} disabled={isVersion && !supersedesQuoteId}>
              Létrehozás
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProjectEditDialog
        project={project}
        open={editProjectOpen}
        onOpenChange={setEditProjectOpen}
        onSave={handleSaveProject}
      />

      <ProjectCloseDialog
        projectId={projectId}
        projectName={project.name}
        open={closeProjectOpen}
        onOpenChange={setCloseProjectOpen}
        tick={tick}
        onClosed={refresh}
      />

      <QuoteImportWizard
        open={quoteImportOpen}
        onOpenChange={setQuoteImportOpen}
        projectId={projectId}
        onCompleted={refresh}
      />
    </div>
  )
}
