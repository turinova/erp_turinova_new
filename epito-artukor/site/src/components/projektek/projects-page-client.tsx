"use client"

import { useEffect, useMemo, useState } from "react"
import { Plus, Search } from "lucide-react"
import type { Project } from "@/types/projects"
import { PROJECT_STATUS_LABELS } from "@/lib/project-labels"
import { createProject, listProjects, getProjectListSummary } from "@/lib/data/projects-store"
import {
  buildProjectListSummary,
  countProjectsByStatus,
  filterProjects,
  sortProjects,
  type ProjectSortKey,
} from "@/lib/project-list-summary"
import {
  filterProjectsByPhase,
  PROJECT_PHASE_LABELS,
  type ProjectListPhase,
} from "@/lib/project-phase"
import { useProjectsBundleReady } from "@/hooks/use-projects-bundle-ready"
import { PageHeader } from "@/components/shell/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ProjectListCard,
  ProjectsEmptyState,
} from "@/components/projektek/project-list-card"
import { ProjectListTable } from "@/components/projektek/project-list-table"
import { ClientSelect } from "@/components/ugyfelek/client-select"
import { cn } from "@/lib/utils"

type ProjectsPageClientProps = {
  phase: ProjectListPhase
}

const PHASE_DESCRIPTIONS: Record<ProjectListPhase, string> = {
  quotes: "Ajánlatkészítés — árazás, alvállalkozói bekérés, ügyfélnek küldés",
  execution: "Elfogadott munkák — teljesítés, megbízások, teljesítésigazolás",
  archive: "Lezárt és archivált projektek",
}

export function ProjectsPageClient({ phase }: ProjectsPageClientProps) {
  const bundleReady = useProjectsBundleReady()
  const [tick, setTick] = useState(0)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<Project["status"] | "all">("all")
  const [sortKey, setSortKey] = useState<ProjectSortKey>("updated")
  const [hideArchived, setHideArchived] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    code: "",
    name: "",
    clientId: "",
    clientName: "",
    siteAddress: "",
    description: "",
  })

  useEffect(() => {
    if (bundleReady) setTick((t) => t + 1)
  }, [bundleReady])

  const allProjects = useMemo(() => {
    void tick
    return filterProjectsByPhase(listProjects(), phase)
  }, [tick, phase])

  const summaries = useMemo(() => {
    void tick
    return new Map(
      allProjects.map((p) => [
        p.id,
        getProjectListSummary(p.id) ?? buildProjectListSummary(p),
      ])
    )
  }, [allProjects, tick])

  const filtered = useMemo(
    () =>
      sortProjects(
        filterProjects(allProjects, {
          q: search,
          status: statusFilter,
          hideArchived: phase !== "archive" && hideArchived,
        }),
        summaries,
        sortKey
      ),
    [allProjects, search, statusFilter, hideArchived, phase, sortKey, summaries]
  )

  const statusCounts = useMemo(() => countProjectsByStatus(allProjects), [allProjects])

  const activeCount = allProjects.length
  const quotingCount = statusCounts.quoting
  const phaseTitle = PROJECT_PHASE_LABELS[phase]
  const canCreateProject = phase === "quotes"
  const phaseStatuses = useMemo(
    () =>
      (Object.keys(PROJECT_STATUS_LABELS) as Project["status"][]).filter(
        (s) => statusCounts[s] > 0
      ),
    [statusCounts]
  )

  const refresh = () => setTick((t) => t + 1)

  const handleCreate = () => {
    if (!form.name.trim() || !form.code.trim()) return
    createProject({
      ...form,
      clientId: form.clientId || undefined,
      status: "prospect",
    })
    setOpen(false)
    setForm({ code: "", name: "", clientId: "", clientName: "", siteAddress: "", description: "" })
    refresh()
  }

  if (!bundleReady) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-slate-500">Projektek betöltése…</p>
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title={phaseTitle}
        description={`${activeCount} projekt${phase === "quotes" && quotingCount > 0 ? ` · ${quotingCount} ajánlatkészítés alatt` : ""} — ${PHASE_DESCRIPTIONS[phase]}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {canCreateProject ? (
              <Button onClick={() => setOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Új projekt
              </Button>
            ) : null}
          </div>
        }
      />

      {allProjects.length > 0 ? (
        <>
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Keresés projekt, kód, ügyfél, helyszín…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={sortKey} onValueChange={(v) => setSortKey(v as ProjectSortKey)}>
                <SelectTrigger className="w-[10.5rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="updated">Legutóbbi</SelectItem>
                  <SelectItem value="sell">Ügyfél ár</SelectItem>
                </SelectContent>
              </Select>
              {phase !== "archive" ? (
                <label className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm text-slate-700">
                  <Checkbox
                    checked={hideArchived}
                    onCheckedChange={(v) => setHideArchived(v === true)}
                  />
                  Archivált rejtése
                </label>
              ) : null}
            </div>
          </div>

          {phaseStatuses.length > 1 ? (
          <div className="mb-4 flex flex-wrap gap-1.5">
            <StatusChip
              active={statusFilter === "all"}
              onClick={() => setStatusFilter("all")}
              label={`Mind (${allProjects.length})`}
            />
            {phaseStatuses.map((s) => (
                <StatusChip
                  key={s}
                  active={statusFilter === s}
                  onClick={() => setStatusFilter(s)}
                  label={`${PROJECT_STATUS_LABELS[s]} (${statusCounts[s]})`}
                />
            ))}
          </div>
          ) : null}

          {filtered.length === 0 ? (
            <div className="rounded-lg border bg-white px-6 py-12 text-center text-sm text-slate-500">
              Nincs találat a szűrőkre.{" "}
              <button
                type="button"
                className="text-blue-600 hover:underline"
                onClick={() => {
                  setSearch("")
                  setStatusFilter("all")
                }}
              >
                Szűrők törlése
              </button>
            </div>
          ) : phase === "quotes" ? (
            <ProjectListTable
              rows={filtered.map((project) => ({
                project,
                summary: summaries.get(project.id)!,
              }))}
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {filtered.map((project) => {
                const summary = summaries.get(project.id)
                if (!summary) return null
                return (
                  <ProjectListCard key={project.id} project={project} summary={summary} />
                )
              })}
            </div>
          )}
        </>
      ) : (
        <ProjectsEmptyState
          onCreate={canCreateProject ? () => setOpen(true) : undefined}
          phase={phase}
        />
      )}

      {canCreateProject ? (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Új projekt</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Projekt kód</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="HYUN-2026-01"
              />
            </div>
            <div className="space-y-2">
              <Label>Projekt neve</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Ügyfél</Label>
              <ClientSelect
                value={form.clientId}
                onChange={(clientId, client) =>
                  setForm((f) => ({
                    ...f,
                    clientId,
                    clientName: client?.displayName ?? "",
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Helyszín</Label>
              <Input
                value={form.siteAddress}
                onChange={(e) => setForm((f) => ({ ...f, siteAddress: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Leírás</Label>
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <p className="text-xs text-slate-500">Új projekt státusza: Lehetőség</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Mégse
            </Button>
            <Button onClick={handleCreate} disabled={!form.name.trim() || !form.code.trim()}>
              Létrehozás
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      ) : null}
    </>
  )
}

function StatusChip({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-sm transition",
        active
          ? "border-[var(--page-accent)] bg-[var(--page-accent-muted)] font-medium text-[var(--page-accent)]"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
      )}
    >
      {label}
    </button>
  )
}
