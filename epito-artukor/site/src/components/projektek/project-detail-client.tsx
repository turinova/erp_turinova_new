"use client"

import { useMemo, useState, useEffect, type CSSProperties } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Plus } from "lucide-react"
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
import { useProjectsBundleReady } from "@/hooks/use-projects-bundle-ready"
import { ProjectQuotesTab } from "@/components/projektek/project-quotes-tab"
import { ProjectOfferTab } from "@/components/projektek/project-offer-tab"
import { RfqProjectTab } from "@/components/projektek/rfq-project-tab"
import { ProjectFilesTab } from "@/components/projektek/project-files-tab"
import { ProjectOverviewTab } from "@/components/projektek/project-overview-tab"
import { ProjectCloseDialog } from "@/components/projektek/project-close-dialog"
import {
  ProjectEditDialog,
  type ProjectEditForm,
} from "@/components/projektek/project-edit-dialog"
import { listProjectFiles } from "@/lib/data/project-files-store"
import { buildProjectOverviewSummary } from "@/lib/project-overview-summary"
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

type Tab = "overview" | "quotes" | "offer" | "rfq" | "files"

type ProjectDetailClientProps = {
  projectId: string
}

export function ProjectDetailClient({ projectId }: ProjectDetailClientProps) {
  const tradeOptions = useTradeOptions()
  const bundleReady = useProjectsBundleReady()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<Tab>("overview")
  const [tick, setTick] = useState(0)
  const [newQuoteOpen, setNewQuoteOpen] = useState(false)
  const [quoteTitle, setQuoteTitle] = useState("Új árajánlat")
  const [quoteTrade, setQuoteTrade] = useState<Trade>("gepeszet")
  const [isVersion, setIsVersion] = useState(false)
  const [supersedesQuoteId, setSupersedesQuoteId] = useState<string>("")
  const [rfqQuoteFilter, setRfqQuoteFilter] = useState<string | null>(null)
  const [rfqAutoOpen, setRfqAutoOpen] = useState(false)
  const [editProjectOpen, setEditProjectOpen] = useState(false)
  const [closeProjectOpen, setCloseProjectOpen] = useState(false)

  const refresh = () => setTick((t) => t + 1)

  useEffect(() => {
    const t = searchParams.get("tab")
    const q = searchParams.get("quote")
    if (
      t === "quotes" ||
      t === "offer" ||
      t === "rfq" ||
      t === "overview" ||
      t === "files"
    )
      setTab(t)
    setRfqQuoteFilter(q)
  }, [searchParams])

  const syncUrl = (newTab: Tab, quoteId?: string | null) => {
    const params = new URLSearchParams()
    if (newTab !== "overview") params.set("tab", newTab)
    const q = quoteId !== undefined ? quoteId : rfqQuoteFilter
    if (q) params.set("quote", q)
    const qs = params.toString()
    router.replace(`/projektek/${projectId}${qs ? `?${qs}` : ""}`, { scroll: false })
  }

  useEffect(() => {
    if (bundleReady) refresh()
  }, [bundleReady])

  const project = useMemo(
    () => (bundleReady ? getProject(projectId) : undefined),
    [projectId, tick, bundleReady]
  )
  const quotes = useMemo(
    () => (bundleReady ? listQuotesForProject(projectId) : []),
    [projectId, tick, bundleReady]
  )

  useEffect(() => {
    if (!bundleReady || quotes.length === 0) return
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
  }, [bundleReady, quotes, searchParams, projectId, router])

  const quoteSummaries = useMemo(() => {
    if (!bundleReady) return new Map()
    return new Map(
      quotes.map((q) => {
        const lines = listQuoteLines(q.id)
        const quoteRfqs = listRfqsForQuote(q.id)
        const subs = listSubmissionsForQuote(q.id)
        const invitations = listInvitationsForQuote(q.id)
        return [q.id, buildQuoteSummary(q, lines, quoteRfqs, subs, invitations)] as const
      })
    )
  }, [quotes, tick, bundleReady])

  const fileCount = useMemo(() => {
    void tick
    return bundleReady ? listProjectFiles(projectId).length : 0
  }, [projectId, tick, bundleReady])

  const overviewHealth = useMemo(() => {
    void tick
    if (!bundleReady) return null
    const o = buildProjectOverviewSummary(projectId)
    return o ? { health: o.health, label: o.healthLabel } : null
  }, [projectId, tick, bundleReady])

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

  if (!bundleReady) {
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
    const title = quoteTitle.trim() || "Új árajánlat"
    const q = createQuote(projectId, title, {
      primaryTrade: quoteTrade,
      supersedesQuoteId: isVersion && supersedesQuoteId ? supersedesQuoteId : undefined,
    })
    setNewQuoteOpen(false)
    setIsVersion(false)
    setSupersedesQuoteId("")
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

  const handleExportPdf = (quoteId: string) => {
    const summary = quoteSummaries.get(quoteId)
    if (!summary?.readiness.canExportPdf) {
      toast.error("PDF export csak teljesen árazott ajánlathoz érhető el")
      return
    }
    toast.info("PDF export hamarosan — az ajánlat küldésre kész")
  }

  const handleSaveProject = (form: ProjectEditForm) => {
    updateProject(projectId, form)
    setEditProjectOpen(false)
    refresh()
    toast.success("Projekt adatai mentve")
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Áttekintés" },
    { id: "quotes", label: "Költségvetés" },
    { id: "offer", label: "Árajánlat" },
    { id: "rfq", label: "Alvállalkozók" },
    { id: "files", label: fileCount > 0 ? `Dokumentumok (${fileCount})` : "Dokumentumok" },
  ]

  const phaseNavItem = findNavItemByHref(listHrefForProject(project))
  const accentStyle = {
    "--page-accent": phaseNavItem?.accent ?? "var(--brand)",
    "--page-accent-muted": phaseNavItem?.accentMuted ?? "var(--brand-muted)",
  } as CSSProperties

  return (
    <div style={accentStyle} className="contents">
      <ProjectDetailHeader
        project={project}
        health={overviewHealth}
        onEdit={() => setEditProjectOpen(true)}
        onClose={
          project.status === "won" || project.status === "in_progress"
            ? () => setCloseProjectOpen(true)
            : undefined
        }
      />

      <div className="mb-6 flex gap-1 border-b">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id)
              syncUrl(t.id, t.id === "rfq" ? rfqQuoteFilter : null)
            }}
            className={cn(
              "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              tab === t.id
                ? "border-[var(--page-accent)] text-[var(--page-accent)]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <ProjectOverviewTab
          projectId={projectId}
          tick={tick}
          onDuplicate={handleDuplicateQuote}
          onDelete={handleDeleteQuote}
          onArchive={handleArchiveQuote}
          onStartRfq={openRfqDialog}
          onExportPdf={handleExportPdf}
          onOpenOfferTab={() => {
            setTab("offer")
            syncUrl("offer", null)
          }}
        />
      ) : null}

      {tab === "quotes" ? (
        <ProjectQuotesTab
          project={project}
          projectId={projectId}
          quotes={quotes}
          quoteSummaries={quoteSummaries}
          onNewQuote={() => setNewQuoteOpen(true)}
          onDuplicate={handleDuplicateQuote}
          onDelete={handleDeleteQuote}
          onArchive={handleArchiveQuote}
          onStartRfq={openRfqDialog}
          onExportPdf={handleExportPdf}
        />
      ) : null}

      {tab === "offer" ? (
        <ProjectOfferTab projectId={projectId} tick={tick} onRefresh={refresh} />
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

      <Dialog open={newQuoteOpen} onOpenChange={setNewQuoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Új szakági ajánlat</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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
                Több ajánlat is lehet ugyanarra a szakágra — később az Árajánlat fülön választod ki,
                melyik megy az ügyfélnek.
              </p>
            )}
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
    </div>
  )
}
